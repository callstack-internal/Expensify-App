import {execSync, spawnSync} from 'node:child_process';
import {existsSync, rmSync} from 'node:fs';
import path from 'node:path';

type RunResult = {
    label: string;
    ms: number;
    exitCode: number | null;
};

const ESLINT_CACHE_DIR = path.resolve(process.cwd(), 'node_modules/.cache/eslint');

function clearEslintCache(): void {
    if (!existsSync(ESLINT_CACHE_DIR)) {
        return;
    }
    rmSync(ESLINT_CACHE_DIR, {recursive: true, force: true});
    console.log('Cache cleared');
}

function nowMs(): number {
    const [sec, ns] = process.hrtime();
    return sec * 1_000 + Math.round(ns / 1_000_000);
}

function runLint(label: string, withCache: boolean): RunResult {
    console.log('-'.repeat(80));
    console.log('\nRun started:', label);
    if (!withCache) {
        clearEslintCache();
    }

    const start = nowMs();
    console.log('\nRun started (start timer):', label, 'withCache:', withCache);
    // Use npm in PATH or npm_execpath if available.
    const rawNpmExecPath: unknown = process.env.npm_execpath;
    const npmExecPath: string | undefined = typeof rawNpmExecPath === 'string' ? rawNpmExecPath : undefined;
    let child: ReturnType<typeof spawnSync>;
    if (typeof npmExecPath === 'string' && npmExecPath.endsWith('npm-cli.js')) {
        child = spawnSync(process.execPath, [npmExecPath, 'run', '-s', 'lint:new'], {
            stdio: 'inherit',
            env: process.env,
        });
    }
    const end = nowMs();
    console.log('\nRun ended (end timer):', label);
    console.log('\nRun completed:', label, 'withCache:', withCache, 'time:', formatMs(end - start));

    return {label, ms: end - start, exitCode: child.status};
}

function formatMs(ms: number): string {
    const seconds = ms / 1000;
    return `${seconds.toFixed(2)}s`;
}

function avg(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted.at(mid - 1) + sorted.at(mid)) / 2;
    }
    return sorted.at(mid);
}

function printSummary(results: RunResult[]): void {
    const warm = results.filter((r) => r.label.includes('warm'));
    const cold = results.filter((r) => r.label.includes('cold'));

    const warmTimes = warm.map((r) => r.ms);
    const coldTimes = cold.map((r) => r.ms);

    // Per-run
    console.log('\nRuns:');
    results.forEach((r) => {
        console.log(`- ${r.label}: ${formatMs(r.ms)}`);
    });

    // Aggregates
    console.log('\nSummary:');
    console.log(`- cold avg:     ${formatMs(avg(coldTimes))}`);
    console.log(`- cold median:  ${formatMs(median(coldTimes))}`);
    console.log(`- warm avg:     ${formatMs(avg(warmTimes))}`);
    console.log(`- warm median:  ${formatMs(median(warmTimes))}`);
}

function main(): void {
    // Ensure ts-node is available when using ts-node to run this file
    try {
        execSync('node -v', {stdio: 'ignore'});
    } catch (e) {
        console.error('Node.js not found in PATH');
        process.exit(1);
    }

    const results: RunResult[] = [];

    // Two cold runs (clear cache before each)
    results.push(runLint('cold #1', false));
    // results.push(runLint('cold #2', false));
    // results.push(runLint('cold #3', false));
    // results.push(runLint('cold #4', false));

    // Two warm runs (do not clear cache)
    // results.push(runLint('warm #1', true));
    // results.push(runLint('warm #2', true));
    // results.push(runLint('warm #3', true));
    // results.push(runLint('warm #4', true));

    printSummary(results);

    // If any run failed, exit with non-zero to surface issues in CI
    const anyFailed = results.some((r) => (r.exitCode ?? 0) !== 0);
    process.exit(anyFailed ? 1 : 0);
}

main();
