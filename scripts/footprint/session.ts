import type {AgentDomainTool, AgentSessionClient} from '@rozenite/agent-sdk';

import type {OnyxProbeReport, RenderStat} from './types';

import {EMPTY_ONYX_STAT} from './types';

const PAGE_LIMIT = 100;
const MAX_PAGES = 20;
const PROFILING_START_TIMEOUT_MS = 15000;
const PROFILING_DATA_WAIT_MS = 10000;

/**
 * A paged tool response arrives either as objects under `items` or, once two or more rows come
 * back, as a columnar `cols`/`rows` pair. Both shapes are documented, so both are handled.
 */
type PagedResult = {
    items?: Array<Record<string, unknown>>;
    cols?: string[];
    rows?: unknown[][];
    page?: {nextCursor?: string};
    next?: {cursor?: string};
};

/** Tool names differ between the docs (camelCase) and live listings (kebab-case), so match on both. */
function normalizeToolName(name: string): string {
    return name.toLowerCase().replaceAll(/[^a-z0-9]/g, '');
}

function resolveToolName(tools: AgentDomainTool[], wanted: string): string {
    const target = normalizeToolName(wanted);
    const match = tools.find((tool) => normalizeToolName(tool.shortName) === target);

    if (!match) {
        throw new Error(`No tool matching "${wanted}". Available: ${tools.map((tool) => tool.shortName).join(', ')}`);
    }

    return match.shortName;
}

function rowsToObjects(result: PagedResult): Array<Record<string, unknown>> {
    if (result.items) {
        return result.items;
    }

    if (!result.cols || !result.rows) {
        return [];
    }

    const cols = result.cols;
    return result.rows.map((row) => Object.fromEntries(cols.map((col, index) => [col, row.at(index)])));
}

function toNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** `displayName` is what the profiler labels a component with; fall back before stringifying. */
function toName(row: Record<string, unknown>): string {
    for (const candidate of [row.displayName, row.name]) {
        if (typeof candidate === 'string' && candidate.length > 0) {
            return candidate;
        }
    }

    return 'unknown';
}

function toStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

/**
 * The tool names this harness needs, resolved once per session so an upstream rename fails at once
 * with a list of what was offered instead of part-way through a run.
 */
type ResolvedTools = {
    startProfiling: string;
    stopProfiling: string;
    isProfilingStarted: string;
    getComponentRenders: string;
};

/**
 * The in-app Onyx probe tools, resolved per run rather than per session.
 * `useRozeniteInAppAgentTool` registers on mount and unregisters on unmount, so relaunching the app
 * between runs drops the whole `app` domain until the component remounts. Resolving these once for
 * the session and reusing them fails on run 1 with `Unknown domain "app"`.
 */
type OnyxTools = {
    start: string;
    stop: string;
};

async function resolveTools(session: AgentSessionClient): Promise<ResolvedTools> {
    const domains = await session.domains.list();

    const react = domains.find((domain) => domain.id === 'react');
    if (!react) {
        throw new Error('The react domain is not present on this target.');
    }
    if (react.availability === 'unsupported') {
        throw new Error(`The react domain is unsupported on this target: ${react.unavailableReason ?? 'no reason given'}`);
    }

    const reactTools = await session.tools.list({domain: 'react'});

    return {
        startProfiling: resolveToolName(reactTools, 'startProfiling'),
        stopProfiling: resolveToolName(reactTools, 'stopProfiling'),
        isProfilingStarted: resolveToolName(reactTools, 'isProfilingStarted'),
        getComponentRenders: resolveToolName(reactTools, 'getComponentRenders'),
    };
}

/**
 * Looks up the in-app Onyx tools as they stand right now. Undefined when the `app` domain is not
 * registered, which is expected straight after a relaunch until the component remounts.
 */
async function resolveOnyxTools(session: AgentSessionClient): Promise<OnyxTools | undefined> {
    const domains = await session.domains.list();

    if (!domains.some((domain) => domain.id === 'app')) {
        return undefined;
    }

    const appTools = await session.tools.list({domain: 'app'});

    return {
        start: resolveToolName(appTools, 'onyx-probe-start'),
        stop: resolveToolName(appTools, 'onyx-probe-stop'),
    };
}

/** Starts both probes. Called immediately before a replay, so the counts cover only that replay. */
async function startCapture(session: AgentSessionClient, tools: ResolvedTools, onyx: OnyxTools | undefined): Promise<void> {
    // Serial, never parallel: the agent transport is session-scoped and does not multiplex.
    if (onyx) {
        await session.tools.call({domain: 'app', tool: onyx.start, args: {}});
    }
    // No `shouldRestart`: that asks React DevTools for reload-and-profile, which a React Native
    // connection does not support ("Reload-and-profile is not supported by this React DevTools
    // connection"). Each replay gets a fresh profiling session without reloading the app.
    await session.tools.call({domain: 'react', tool: tools.startProfiling, args: {}});

    // Straight after a relaunch the DevTools front-end may still be attaching. startProfiling then
    // reports success while recording nothing, which surfaces later as "No React profiling data
    // available", so confirm it started before replaying.
    const deadline = Date.now() + PROFILING_START_TIMEOUT_MS;

    while (Date.now() < deadline) {
        const status = await session.tools.call<Record<string, never>, {isProfilingStarted?: boolean}>({
            domain: 'react',
            tool: tools.isProfilingStarted,
            args: {},
        });

        if (status.isProfilingStarted) {
            return;
        }

        await new Promise((resolve) => {
            setTimeout(resolve, 500);
        });
    }

    throw new Error('React profiling did not start within the timeout. The DevTools connection may still be attaching; retry, or reload the app JS.');
}

async function collectComponentRenders(session: AgentSessionClient, tools: ResolvedTools, topN: number): Promise<{renders: RenderStat[]; componentCount: number}> {
    const collected: Array<Record<string, unknown>> = [];
    let cursor: string | undefined;
    let pages = 0;

    do {
        const args = cursor ? {sort: 'render-count-desc', limit: PAGE_LIMIT, cursor, fields: 'changedKeys'} : {sort: 'render-count-desc', limit: PAGE_LIMIT, fields: 'changedKeys'};

        // A replay can legitimately produce no commits, and the profiler then holds no data and this
        // call errors. Report the empty run instead of crashing, so the cause stays visible: a tap
        // that escaped the app, or a flow that navigated nowhere.
        let result: PagedResult;
        try {
            result = await session.tools.call<typeof args, PagedResult>({domain: 'react', tool: tools.getComponentRenders, args});
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            if (message.includes('No React profiling data')) {
                console.warn('  No component rendered during this replay. Check that the flow reached the app and its taps landed inside it.');
                return {renders: [], componentCount: 0};
            }

            throw error;
        }

        pages++;
        collected.push(...rowsToObjects(result));
        cursor = result.page?.nextCursor ?? result.next?.cursor;

        // Rows arrive sorted by render count, so the tail cannot change the top N.
        if (collected.length >= topN) {
            break;
        }
    } while (cursor && pages < MAX_PAGES);

    const renders = collected.slice(0, topN).map<RenderStat>((row) => ({
        name: toName(row),
        renderCount: toNumber(row.renderCount),
        totalDurationMs: toNumber(row.totalDurationMs),
        changedKeys: toStringArray(row.changedKeys),
    }));

    return {renders, componentCount: collected.length};
}

/** Stops both probes and returns what they counted. */
async function stopCapture(
    session: AgentSessionClient,
    tools: ResolvedTools,
    onyxTools: OnyxTools | undefined,
    topN: number,
): Promise<{onyx: OnyxProbeReport; renders: RenderStat[]; componentCount: number}> {
    await session.tools.call({domain: 'react', tool: tools.stopProfiling, args: {waitForDataMs: PROFILING_DATA_WAIT_MS, slowRenderThresholdMs: 16}});

    const onyx = onyxTools
        ? await session.tools.call<Record<string, never>, OnyxProbeReport>({domain: 'app', tool: onyxTools.stop, args: {}})
        : {startedAt: 0, durationMs: 0, totals: EMPTY_ONYX_STAT, byKey: {}};
    const {renders, componentCount} = await collectComponentRenders(session, tools, topN);

    return {onyx, renders, componentCount};
}

export {resolveOnyxTools, resolveTools, startCapture, stopCapture};
export type {OnyxTools, ResolvedTools};
