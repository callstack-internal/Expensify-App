/**
 * Runtime footprint harness.
 *
 * Counts what a flow costs at runtime, in Onyx subscription activity and React commits, and
 * compares it against a committed baseline.
 *
 *   footprint doctor
 *   footprint capture <flow> [--platform ios|android] [--runs 5] [--baseline] [--out path]
 *   footprint diagnose <flow> [--platform ios|android]
 *   footprint compare <baseline.json> <candidate.json> [--markdown]
 *
 * Prerequisites for capture and diagnose:
 *   1. Metro running with Rozenite enabled:  WITH_ROZENITE=true npm start
 *   2. A debug build built against that Metro, connected and installed
 *   3. `agent-device` on PATH
 *
 * Every number this produces comes from a debug build and is only meaningful as a ratio against
 * another debug-build capture of the same flow on the same platform.
 */

import type {AgentClient} from '@rozenite/agent-sdk';

import {createAgentClient} from '@rozenite/agent-sdk';
import {spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

import type {Flow, Platform} from './device';
import type {FootprintCapture, FootprintRun} from './types';

import {aggregateRuns} from './aggregate';
import {compareCaptures} from './compare';
import {assertPreconditions, attachApp, describeAgentDevice, launchApp, replay, reset, resetDaemon, resolveFlow, sleep, waitForUiReady} from './device';
import {findingsAsMarkdown, printCapture, printFindings} from './report';
import {resolveOnyxTools, resolveTools, startCapture, stopCapture} from './session';

const DEFAULT_RUNS = 5;
const TOP_N = 25;
const BASELINE_DIR = 'footprint/baselines';
const CANDIDATE_DIR = 'footprint/candidates';
const LAUNCH_SETTLE_MS = 5000;
const BETWEEN_RUNS_MS = 1000;

/**
 * Last resort, used only when no target is connected to read an id from. HybridApp and standalone
 * NewDot ship different ids on both platforms (Android HybridApp is `org.me.mobiexpensifyg.dev`,
 * standalone is `com.expensify.chat.dev`), so prefer the connected target's own `appId`.
 * `--app-id` overrides both.
 */
const FALLBACK_APP_IDS: Record<Platform, string> = {
    ios: 'com.expensify.expensifylite',
    android: 'org.me.mobiexpensifyg.dev',
};

type CaptureOptions = {
    flow: string;
    platform: Platform;
    runs: number;

    /** Explicit `--app-id`; when absent the connected target's own id is used. */
    appId?: string;
    deviceId?: string;
    outPath?: string;
    writeBaseline: boolean;

    /**
     * Measure from wherever the app already is: no relaunch, no warmup, no reset. `diagnose` sets
     * this. Relaunching is the most fragile step, since a physical device's snapshot helper can
     * stay unreadable well afterwards, and one run needs no run-to-run comparability.
     */
    skipLaunch: boolean;
};

function currentCommit(): string {
    const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {encoding: 'utf8'});
    return result.status === 0 ? result.stdout.trim() : 'unknown';
}

function parsePlatform(value: string | undefined): Platform {
    if (value === 'ios' || value === 'android') {
        return value;
    }
    if (value === undefined) {
        return 'android';
    }
    throw new Error(`--platform must be "ios" or "android", got "${value}".`);
}

function baselinePath(flow: string, platform: Platform): string {
    return path.join(BASELINE_DIR, `${flow}.${platform}.json`);
}

/** Candidates land where CI looks for them, so a capture never leaves a stray file in the root. */
function candidatePath(flow: string, platform: Platform): string {
    return path.join(CANDIDATE_DIR, `${flow}.${platform}.json`);
}

/**
 * Validates enough of a capture file to fail loudly on a hand-edited or truncated baseline, rather
 * than comparing against zeroes and reporting a clean run.
 */
function isFootprintCapture(value: unknown): value is FootprintCapture {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const candidate: Record<string, unknown> = value;

    return (
        typeof candidate.flow === 'string' &&
        (candidate.platform === 'ios' || candidate.platform === 'android') &&
        typeof candidate.runs === 'number' &&
        typeof candidate.onyx === 'object' &&
        candidate.onyx !== null &&
        Array.isArray(candidate.renders)
    );
}

function readCapture(filePath: string): FootprintCapture {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));

    if (!isFootprintCapture(parsed)) {
        throw new Error(`${filePath} is not a footprint capture: expected flow, platform, runs, onyx and renders.`);
    }

    return parsed;
}

function writeCapture(filePath: string, capture: FootprintCapture): void {
    mkdirSync(path.dirname(filePath), {recursive: true});
    writeFileSync(filePath, `${JSON.stringify(capture, null, 2)}\n`);
}

/** One warmup replay plus `runs` measured replays, each with its own probe window. */
/** Brings the app to the flow's starting state and verifies it before anything is measured. */
async function prepareForFlow(flow: Flow, options: CaptureOptions, appId: string, relaunch: boolean): Promise<void> {
    if (relaunch) {
        launchApp(appId, options.platform);
        await sleep(LAUNCH_SETTLE_MS);
    }

    await waitForUiReady(options.platform);

    // Check @pre before replaying: a flow from flows/tests/ is a fragment that assumes a starting
    // state, and a bare "Selector did not match" from step 1 does not say that is what went wrong.
    await assertPreconditions(flow, options.platform);
}

/**
 * One warmup replay, then `runs` measured replays.
 *
 * A Rozenite session is opened per run, after the app is up. Relaunching kills the JS runtime and
 * any session bound to the old debug target, so a session opened once around every run dies on the
 * first reset with `Session ... is not connected to a device`.
 */
async function measureRuns(client: AgentClient, flow: Flow, options: CaptureOptions, appId: string): Promise<FootprintRun[]> {
    const runs: FootprintRun[] = [];

    // Clear any daemon a different agent-device version left running, before `open` creates the
    // session the replays depend on.
    resetDaemon();

    if (options.skipLaunch) {
        // Still needs a session, just not a restart: every state query is session-scoped.
        attachApp(appId, options.platform);
        await assertPreconditions(flow, options.platform);
    } else {
        await prepareForFlow(flow, options, appId, true);

        // Warmup: the first replay after a launch pays for lazy module evaluation and cold Onyx
        // reads, which would otherwise land entirely in run 1 and skew it against every later run.
        console.log('Warmup replay...');
        replay(flow, options.platform);
        reset(flow, appId, options.platform);
        await sleep(BETWEEN_RUNS_MS);
        await prepareForFlow(flow, options, appId, false);
    }

    for (let run = 1; run <= options.runs; run++) {
        console.log(`Run ${run}/${options.runs}`);

        const measured = await client.withSession(options.deviceId ? {deviceId: options.deviceId} : {}, async (session) => {
            const tools = await resolveTools(session);

            // Resolved per run too: a relaunch unmounts the in-app tools, so the `app` domain is
            // absent until FootprintAgentTools remounts.
            const onyxTools = await resolveOnyxTools(session);
            if (!onyxTools) {
                console.warn('  `app` domain not registered. Onyx counts will be empty for this run; reload the JS bundle to re-register.');
            }

            await startCapture(session, tools, onyxTools);
            replay(flow, options.platform);
            return stopCapture(session, tools, onyxTools, TOP_N);
        });

        runs.push({onyx: measured.onyx.byKey, renders: measured.renders, componentCount: measured.componentCount});

        if (options.skipLaunch) {
            continue;
        }

        reset(flow, appId, options.platform);
        await sleep(BETWEEN_RUNS_MS);

        if (run < options.runs) {
            await prepareForFlow(flow, options, appId, false);
        }
    }

    return runs;
}

async function captureFlow(options: CaptureOptions): Promise<FootprintCapture> {
    const flow = resolveFlow(options.flow);
    console.log(`Using ${describeAgentDevice()}`);

    const client = createAgentClient();

    const targets = await client.targets.list();
    if (targets.length === 0) {
        throw new Error('No Metro targets are connected. Start the app against `WITH_ROZENITE=true npm start` first.');
    }
    if (targets.length > 1 && !options.deviceId) {
        // Reanimated and worklets each add a debuggable runtime, so several pages per device is normal.
        console.log(`${targets.length} targets connected; using the first. Pass --device <deviceId> to pin one.`);
    }

    const target = options.deviceId ? targets.find((entry) => entry.deviceId === options.deviceId) : targets.at(0);
    if (!target) {
        throw new Error(`No connected target has deviceId "${options.deviceId ?? ''}". Connected: ${targets.map((entry) => entry.deviceId).join(', ')}`);
    }

    // Prefer what the device says it is running over any guess this script could make.
    const appId = options.appId ?? target.appId ?? FALLBACK_APP_IDS[options.platform];
    console.log(`Target ${target.deviceId} · app ${appId}`);

    const runs = await measureRuns(client, flow, options, appId);

    const {onyx, renders} = aggregateRuns(runs);

    return {
        flow: flow.name,
        platform: options.platform,
        appId,
        runs: options.runs,
        commit: currentCommit(),
        capturedAt: new Date().toISOString(),
        onyx,
        renders,
    };
}

/**
 * Reports what the toolchain can see, without touching the app. Run it first when a capture comes
 * back empty: Metro without Rozenite, an app that has not registered its probe, and a wrong target
 * all look the same from the outside.
 */
async function doctor(deviceId: string | undefined): Promise<void> {
    console.log(`Using ${describeAgentDevice()}`);

    const client = createAgentClient();
    const targets = await client.targets.list();

    if (targets.length === 0) {
        throw new Error('No Metro targets are connected. Start the app against `WITH_ROZENITE=true npm start` first.');
    }

    console.log(`\nTargets (${targets.length}):`);
    for (const target of targets) {
        console.log(`  ${target.deviceId}  app=${target.appId}  ${target.name}  ${target.integration}`);
    }

    await client.withSession(deviceId ? {deviceId} : {}, async (session) => {
        const domains = await session.domains.list();

        console.log(`\nDomains (${domains.length}):`);
        for (const domain of domains) {
            console.log(`  ${domain.id.padEnd(14)} ${domain.kind.padEnd(7)} ${domain.availability ?? 'supported'}`);
        }

        const react = domains.find((domain) => domain.id === 'react');
        console.log(`\nreact  ${react ? 'present' : 'MISSING, so the profiler half cannot run'}`);

        const app = domains.find((domain) => domain.id === 'app');
        if (!app) {
            console.log('app    MISSING, so Onyx counts will be empty. Reload the JS bundle to re-register the in-app tools.');
            return;
        }

        const appTools = await session.tools.list({domain: 'app'});
        console.log(`app    present: ${appTools.map((tool) => tool.shortName).join(', ')}`);
    });
}

function usage(): string {
    return [
        'Usage:',
        '  bun scripts/footprint/index.ts doctor [--device id]',
        '  bun scripts/footprint/index.ts capture <flow> [--platform ios|android] [--runs 5] [--baseline] [--out path] [--app-id id] [--device id]',
        '  bun scripts/footprint/index.ts diagnose <flow> [--platform ios|android] [--app-id id] [--device id]',
        '  bun scripts/footprint/index.ts compare <baseline.json> <candidate.json> [--markdown]',
    ].join('\n');
}

function flagValue(argv: string[], flag: string): string | undefined {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv.at(index + 1) : undefined;
}

function buildCaptureOptions(argv: string[], flowName: string | undefined, runs: number, writeBaseline: boolean, skipLaunch: boolean): CaptureOptions {
    if (!flowName) {
        throw new Error(`A flow name is required.\n\n${usage()}`);
    }

    const platform = parsePlatform(flagValue(argv, '--platform'));

    return {
        flow: flowName,
        platform,
        runs,
        appId: flagValue(argv, '--app-id'),
        deviceId: flagValue(argv, '--device'),
        outPath: flagValue(argv, '--out'),
        writeBaseline,
        skipLaunch,
    };
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2);
    const [command, first, second] = argv;

    if (command === 'doctor') {
        await doctor(flagValue(argv, '--device'));
        return;
    }

    if (command === 'capture' || command === 'diagnose') {
        const isDiagnose = command === 'diagnose';
        const requestedRuns = Number(flagValue(argv, '--runs') ?? DEFAULT_RUNS);

        if (!Number.isInteger(requestedRuns) || requestedRuns < 1) {
            throw new Error(`--runs must be a positive integer, got "${flagValue(argv, '--runs')}".`);
        }

        // diagnose is the one-shot developer command: no baseline, no medians.
        // diagnose measures in place; capture relaunches for comparability unless told not to.
        const skipLaunch = isDiagnose ? !argv.includes('--relaunch') : argv.includes('--no-relaunch');
        const options = buildCaptureOptions(argv, first, isDiagnose ? 1 : requestedRuns, argv.includes('--baseline'), skipLaunch);
        const result = await captureFlow(options);

        console.log(printCapture(result, TOP_N));

        if (isDiagnose) {
            return;
        }

        const outPath = options.outPath ?? (options.writeBaseline ? baselinePath(result.flow, result.platform) : candidatePath(result.flow, result.platform));
        writeCapture(outPath, result);
        console.log(`Written to ${outPath}`);
        return;
    }

    if (command === 'compare') {
        if (!first || !second) {
            throw new Error(`compare needs a baseline and a candidate file.\n\n${usage()}`);
        }

        const baseline = readCapture(first);
        const candidate = readCapture(second);
        const findings = compareCaptures(baseline, candidate);

        console.log(argv.includes('--markdown') ? findingsAsMarkdown(baseline, candidate, findings) : printFindings(findings));

        // Only a flag fails the gate; warnings stay advisory while the thresholds are unproven.
        if (findings.some((finding) => finding.severity === 'flag')) {
            process.exit(1);
        }
        return;
    }

    console.log(usage());
    process.exit(command === undefined || command === '--help' ? 0 : 1);
}

main().catch((error: unknown) => {
    console.error(`\nfootprint failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
