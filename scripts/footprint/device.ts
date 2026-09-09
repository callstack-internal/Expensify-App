import {spawnSync} from 'node:child_process';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type Platform = 'ios' | 'android';

/** Flow metadata the harness reads out of a `.ad` file's `# @` headers. */
type Flow = {
    name: string;
    filePath: string;
    /** Absolute path to the flow that returns the app to this flow's `@pre` state, when declared. */
    resetFlowPath?: string;
    params: string[];

    /**
     * `@pre` selectors, ANDed. Flows under `flows/tests/` assume a starting state; check these
     * first or step 1 fails with a bare "Selector did not match".
     */
    preconditions: string[];
};

const FLOWS_SUBPATH = '.claude/skills/agent-device/flows';

/** `-e KEY=VALUE` flow parametrisation landed in agent-device 0.13.0. */
const MIN_PARAM_VERSION = [0, 13, 0];

/**
 * agent-device is often installed once per nvm node version, at different versions. A run must use
 * one binary throughout: a newer client replaces an older daemon, which destroys the session
 * `open` just created, and `replay` then fails with "No active session. Run open first." Resolved
 * once here so the run does not depend on the ambient PATH.
 */
let resolvedBinary: {command: string; version: number[]} | undefined;

/**
 * Passed on every call. Without it, `replay` and `test` start an ephemeral daemon in the system
 * temp dir, which holds no session, and fail with "No active session. Run open first."
 */
const STATE_DIR = path.join(os.homedir(), '.agent-device');

/**
 * A session binds to one device for its lifetime and `close` does not reliably release it, so a
 * session used for Android refuses later iOS requests. One session name per platform.
 */
function sessionName(platform: Platform): string {
    return `footprint-${platform}`;
}

/** Appends the global flags that must be on every agent-device call. */
function withGlobalFlags(args: string[]): string[] {
    return [...args, '--state-dir', STATE_DIR];
}

function parseVersion(raw: string): number[] {
    return raw
        .trim()
        .split('.')
        .map((part) => Number.parseInt(part, 10) || 0);
}

function versionOf(command: string): number[] | undefined {
    const result = spawnSync(command, ['--version'], {encoding: 'utf8'});
    return result.status === 0 ? parseVersion(result.stdout) : undefined;
}

function candidateBinaries(): string[] {
    const override = process.env.AGENT_DEVICE_BIN;
    if (override) {
        return [override];
    }

    const nvmRoot = path.join(os.homedir(), '.nvm', 'versions', 'node');
    const installed = existsSync(nvmRoot)
        ? readdirSync(nvmRoot)
              .map((version) => path.join(nvmRoot, version, 'bin', 'agent-device'))
              .filter((candidate) => existsSync(candidate))
        : [];

    return ['agent-device', ...installed];
}

function agentDevice(): {command: string; version: number[]} {
    if (resolvedBinary) {
        return resolvedBinary;
    }

    const found = candidateBinaries()
        .map((command) => ({command, version: versionOf(command)}))
        .filter((entry): entry is {command: string; version: number[]} => !!entry.version)
        .sort((a, b) => {
            for (const [index, part] of b.version.entries()) {
                const mine = a.version.at(index) ?? 0;
                if (mine !== part) {
                    return part - mine;
                }
            }
            return 0;
        });

    const best = found.at(0);
    if (!best) {
        throw new Error('agent-device is not installed, or not on PATH. Set AGENT_DEVICE_BIN to its absolute path.');
    }

    resolvedBinary = best;
    return best;
}

/** Prints which binary the run will use, so a version clash is visible in the log. */
function describeAgentDevice(): string {
    const {command, version} = agentDevice();
    return `agent-device ${version.join('.')} (${command})`;
}

function repoRoot(): string {
    const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {encoding: 'utf8'});

    if (result.status !== 0) {
        throw new Error('Not inside a git repository, so the flows directory cannot be located.');
    }

    return result.stdout.trim();
}

function readHeaderValues(contents: string, key: string): string[] {
    const pattern = new RegExp(`^#\\s*@${key}\\s+(.+)$`, 'gm');
    return [...contents.matchAll(pattern)].map((match) => match[1].trim());
}

/**
 * Resolves a flow by bare name under `flows/tests/`, mirroring how `measure.sh` discovers flows so
 * that the same `.ad` files serve both the span harness and this one.
 */
function resolveFlow(name: string): Flow {
    const root = repoRoot();
    const testsDir = path.join(root, FLOWS_SUBPATH, 'tests');

    if (!existsSync(testsDir)) {
        throw new Error(`Flows directory not found at ${testsDir}.`);
    }

    const fileName = name.endsWith('.ad') ? name : `${name}.ad`;
    const filePath = path.join(testsDir, fileName);

    if (!existsSync(filePath)) {
        const available = readdirSync(testsDir)
            .filter((entry) => entry.endsWith('.ad'))
            .map((entry) => entry.replace(/\.ad$/, ''))
            .sort()
            .join(', ');
        throw new Error(`No flow named "${name}" in ${testsDir}. Available: ${available}`);
    }

    const contents = readFileSync(filePath, 'utf8');
    const [declaredReset] = readHeaderValues(contents, 'reset');

    let resetFlowPath: string | undefined;
    if (declaredReset) {
        resetFlowPath = path.isAbsolute(declaredReset) ? declaredReset : path.join(root, declaredReset);

        if (!statSync(resetFlowPath, {throwIfNoEntry: false})) {
            throw new Error(`Flow "${name}" declares @reset ${declaredReset}, which does not exist.`);
        }
    }

    return {
        name: fileName.replace(/\.ad$/, ''),
        filePath,
        resetFlowPath,
        params: readHeaderValues(contents, 'param').map((line) => line.split(/\s+/).at(0) ?? ''),
        preconditions: readHeaderValues(contents, 'pre'),
    };
}

/** Runs agent-device without throwing, for checks where a non-zero exit is the answer. */
function probeAgentDevice(args: string[]): {status: number; stdout: string; stderr: string} {
    const result = spawnSync(agentDevice().command, withGlobalFlags(args), {encoding: 'utf8'});
    return {status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? ''};
}

/**
 * State-reading commands need the target named. Without `--platform` they default to iOS and fail
 * with SESSION_NOT_FOUND, which looks like a selector that did not match.
 */
function targeted(args: string[], platform: Platform): string[] {
    return [...args, '--platform', platform, '--session', sessionName(platform)];
}

function isAtLeast(version: number[], minimum: number[]): boolean {
    for (const [index, floor] of minimum.entries()) {
        const part = version.at(index) ?? 0;

        if (part !== floor) {
            return part > floor;
        }
    }

    return true;
}

function runAgentDevice(args: string[]): void {
    const {command} = agentDevice();
    const result = spawnSync(command, withGlobalFlags(args), {encoding: 'utf8', stdio: ['ignore', 'inherit', 'inherit']});

    if (result.error) {
        throw new Error(`Could not run ${command} (${result.error.message}).`);
    }

    if (result.status !== 0) {
        throw new Error(`agent-device ${args.join(' ')} exited with ${result.status ?? 'a signal'}.`);
    }
}

/** Stops a daemon left by another agent-device version, before the run's first `open`. */
function resetDaemon(): void {
    probeAgentDevice(['daemon', 'stop', '--clean']);
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * `@param KEY` headers read `AD_<KEY>` from the environment, the convention `measure.sh` already
 * uses, so a flow parametrised for the span harness needs no second set of inputs.
 */
function flowEnvArgs(flow: Flow): string[] {
    if (flow.params.length === 0) {
        return [];
    }

    const missing = flow.params.filter((key) => !process.env[`AD_${key}`]);
    if (missing.length > 0) {
        throw new Error(`Flow "${flow.name}" declares @param ${missing.join(', ')}. Supply each as AD_<KEY> in the environment, or pick a flow with no parameters.`);
    }

    const {version} = agentDevice();
    if (!isAtLeast(version, MIN_PARAM_VERSION)) {
        throw new Error(
            `Flow "${flow.name}" is parametrised, which needs agent-device ${MIN_PARAM_VERSION.join('.')} or newer for -e KEY=VALUE. Installed: ${version.join('.')}. Upgrade, or use a flow with no @param headers.`,
        );
    }

    return flow.params.flatMap((key) => ['-e', `${key}=${process.env[`AD_${key}`] ?? ''}`]);
}

function launchApp(appId: string, platform: Platform): void {
    runAgentDevice(['open', appId, '--platform', platform, '--session', sessionName(platform), '--relaunch']);
}

/** Binds a session to the app already running, without restarting it. */
function attachApp(appId: string, platform: Platform): void {
    runAgentDevice(['open', appId, '--platform', platform, '--session', sessionName(platform)]);
}

function replay(flow: Flow, platform: Platform): void {
    runAgentDevice(['replay', flow.filePath, '--session', sessionName(platform), ...flowEnvArgs(flow)]);
}

/**
 * Returns the app to the flow's starting state. With no `@reset` declared, relaunch is the only way
 * back; leaving the app in the previous run's `@post` state makes run 2 measure something else.
 */
function reset(flow: Flow, appId: string, platform: Platform): void {
    if (flow.resetFlowPath) {
        runAgentDevice(['replay', flow.resetFlowPath, '--session', sessionName(platform)]);
        return;
    }

    launchApp(appId, platform);
}

/** After `--relaunch`, UIAutomator briefly reports an empty snapshot and `@pre` fails spuriously. */
async function waitForUiReady(platform: Platform, timeoutMs = 30000): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    // Readiness means the snapshot returns at all. An earlier version matched specific labels and
    // burned the full timeout on a screen that was ready; @pre runs next and checks the screen.
    while (Date.now() < deadline) {
        if (probeAgentDevice(targeted(['snapshot'], platform)).status === 0) {
            return;
        }

        await sleep(1000);
    }

    console.warn('Snapshot did not become readable within the timeout; continuing to the @pre check anyway.');
}

/**
 * Dismisses a React Native warning overlay. LogBox covers part of a dev build's screen, so every
 * selector under it misses and the failure looks like a wrong precondition. Best effort: with no
 * overlay up the command exits non-zero, which is fine.
 */
function dismissOverlays(platform: Platform): void {
    probeAgentDevice(targeted(['react-native', 'dismiss-overlay'], platform));
}

/** Verifies every `@pre` selector, polling briefly, and returns the ones that never matched. */
async function unmetPreconditions(flow: Flow, platform: Platform, timeoutMs = 15000): Promise<string[]> {
    if (flow.preconditions.length === 0) {
        return [];
    }

    const deadline = Date.now() + timeoutMs;
    let unmet = flow.preconditions;

    while (Date.now() < deadline && unmet.length > 0) {
        unmet = unmet.filter((selector) => {
            const {status, stderr} = probeAgentDevice(targeted(['is', 'exists', selector], platform));

            // Reporting a missing session as a failed assertion sends the reader to the wrong screen.
            if (stderr.includes('SESSION_NOT_FOUND')) {
                throw new Error('No active agent-device session. The app must be opened first (`agent-device open <appId> --platform <platform>`).');
            }

            return status !== 0;
        });

        if (unmet.length > 0) {
            await sleep(1000);
        }
    }

    return unmet;
}

/**
 * Fails before replaying when the flow cannot start from where the app is. `submit-expense` needs
 * the confirmation page already open, and relaunching lands on the Inbox, so it cannot run cold.
 */
async function assertPreconditions(flow: Flow, platform: Platform): Promise<void> {
    dismissOverlays(platform);
    const unmet = await unmetPreconditions(flow, platform);

    if (unmet.length === 0) {
        return;
    }

    throw new Error(
        [
            `Flow "${flow.name}" cannot start from the app's current state.`,
            `Unmet @pre: ${unmet.join(' AND ')}`,
            'Drive the app to that state first, or pick a flow whose @pre holds at launch:',
            'open-create-expense, open-search-router, scan-receipt-init, switch-home-to-reports.',
        ].join('\n'),
    );
}

export {assertPreconditions, attachApp, describeAgentDevice, launchApp, replay, reset, resetDaemon, resolveFlow, sleep, waitForUiReady};
export type {Flow, Platform};
