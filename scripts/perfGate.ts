import type {SpawnSyncReturns} from 'node:child_process';

/**
 * A/B duration gate for Reassure `measureFunction` benchmarks.
 *
 * Times the base and the head tree on the same machine, taking turns (base/head, then head/base, ...),
 * and decides per benchmark from a paired confidence interval on the head/base duration ratio:
 * - "regression": the whole interval is above 1 + threshold and the slowdown is above --min-delta-ms, so it is real and big enough to matter.
 * - "ok": the whole interval is below 1 + threshold, or even its upper end adds less than --min-delta-ms.
 * - "unclear": still straddling the limits when the round or time budget runs out.
 *
 * Benchmarks always come from the directory the script runs in and are copied into both trees,
 * so a PR that adds a benchmark is measured against the base with that same benchmark.
 *
 * --engine picks what runs the benchmarks:
 * - jest (default): Reassure `.perf-local.ts` files, with the Reassure CLI's Node flags.
 * - node / hermes: engine entries (tests/perf-local/engine/*.ts), bundled per tree by scripts/bundleEngineBench.ts and run on
 *   plain Node or on the Hermes CLI (--hermes-bin, built from the Hermes tag React Native ships).
 *
 * Usage:
 *   bun scripts/perfGate.ts --base-dir <path> --head-dir <path> --test <file> [--test ...] [--engine jest|node|hermes] [--hermes-bin <path>]
 *     [--threshold 0.1] [--min-delta-ms 0.5] [--min-rounds 5] [--max-rounds 20] [--max-minutes 10] [--output <dir>]
 */
import {spawnSync} from 'node:child_process';
import {cpSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {basename, join, resolve} from 'node:path';

type Side = 'base' | 'head';

type Engine = 'jest' | 'node' | 'hermes';

type Options = {
    baseDir: string;
    headDir: string;
    tests: string[];
    engine: Engine;
    hermesBin: string;
    threshold: number;
    minDeltaMs: number;
    minRounds: number;
    maxRounds: number;
    maxMinutes: number;
    outputDir: string;
};

type Verdict = 'ok' | 'regression' | 'unclear';

type BenchmarkResult = {
    name: string;
    rounds: number;
    droppedRounds: number;
    baseMedianMs: number;
    headMedianMs: number;
    ratio: number;
    ratioLow: number;
    ratioHigh: number;
    verdict: Verdict;
};

// Two-sided 95% Student t critical values by degrees of freedom; past 30 the normal 1.96 is close enough.
const T_95 = [
    12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052,
    2.048, 2.045, 2.042,
];

// Below this many rounds there are too few pairs to tell a stalled one from normal spread.
const MIN_ROUNDS_FOR_DROPPING = 6;
const MAD_TO_STANDARD_DEVIATION = 1.4826;
const STALLED_ROUND_CUTOFF = 4;

// Same flags the Reassure CLI passes on Node 20+, so numbers match `npm run perf-local`.
const NODE_FLAGS = ['--expose-gc', '--no-concurrent-sweeping', '--max-old-space-size=4096', '--max-opt=1'];

const MAX_RUN_ATTEMPTS = 2;

// Enough of a failed Jest or engine run to show the error without the whole log.
const FAILURE_OUTPUT_TAIL_LINES = 60;

// Shared test helpers come from the running checkout too, so both sides use identical data builders.
const HARNESS_DIRS = ['tests/perf-local', 'tests/utils'];

function parseOptions(argv: string[]): Options {
    const values = new Map<string, string[]>();
    for (let index = 0; index < argv.length; index += 2) {
        const key = argv.at(index);
        const value = argv.at(index + 1);
        if (!key?.startsWith('--') || value === undefined) {
            throw new Error(`Invalid argument near "${key}". Expected --name value pairs.`);
        }
        values.set(key.slice(2), [...(values.get(key.slice(2)) ?? []), value]);
    }

    const getOption = (name: string, fallback?: string): string => {
        const value = values.get(name)?.at(-1) ?? fallback;
        if (value === undefined) {
            throw new Error(`Missing required --${name}`);
        }
        return value;
    };

    const tests = values.get('test') ?? [];
    if (tests.length === 0) {
        throw new Error('Pass at least one --test');
    }

    const engine = getOption('engine', 'jest');
    if (engine !== 'jest' && engine !== 'node' && engine !== 'hermes') {
        throw new Error(`Unknown --engine ${engine}; use jest, node or hermes`);
    }

    const getNumberOption = (name: string, fallback: string): number => {
        const value = Number(getOption(name, fallback));
        if (!Number.isFinite(value) || value < 0) {
            throw new Error(`--${name} must be a non-negative number`);
        }
        return value;
    };

    // A bare name such as the default `hermes` is looked up on PATH; only a path is made absolute.
    const hermesBin = getOption('hermes-bin', process.env.HERMES_BIN ?? 'hermes');

    return {
        baseDir: resolve(getOption('base-dir')),
        headDir: resolve(getOption('head-dir')),
        tests,
        engine,
        hermesBin: hermesBin.includes('/') ? resolve(hermesBin) : hermesBin,
        threshold: getNumberOption('threshold', '0.1'),
        minDeltaMs: getNumberOption('min-delta-ms', '0.5'),
        minRounds: getNumberOption('min-rounds', '5'),
        maxRounds: getNumberOption('max-rounds', '20'),
        maxMinutes: getNumberOption('max-minutes', '10'),
        outputDir: resolve(getOption('output', '.reassure/perf-gate')),
    };
}

function copyHarness(targetDir: string) {
    if (resolve(targetDir) === resolve(process.cwd())) {
        return;
    }
    for (const dir of HARNESS_DIRS) {
        cpSync(join(process.cwd(), dir), join(targetDir, dir), {recursive: true, force: true});
    }
}

/** Bundles each engine entry inside its tree, so the base side runs the base tree's app code. Returns the files to run. */
function prepareBundles(side: Side, dir: string, options: Options): string[] {
    const bundlerPath = join(process.cwd(), 'scripts/bundleEngineBench.ts');
    return options.tests.map((test) => {
        const outFile = join(options.outputDir, 'bundles', side, basename(test).replace(/\.tsx?$/, '.js'));
        const result = spawnSync(process.execPath, [bundlerPath, join(dir, test), outFile, ...(options.engine === 'hermes' ? ['--hermes'] : [])], {
            cwd: dir,
            encoding: 'utf8',
        });
        if (result.status !== 0) {
            throw new Error(`Bundling ${test} for ${side} failed:\n${describeFailure(result).join('\n')}`);
        }
        return options.engine === 'hermes' ? outFile.replace(/\.js$/, '.hbc') : outFile;
    });
}

/** Output of a failed child, or why it never started (status and output are null when spawning itself failed). */
function describeFailure(result: SpawnSyncReturns<string>): string[] {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.split('\n').filter((line) => !/^\s+at /.test(line));
    return [...(result.error ? [`Could not start: ${result.error.message}`] : []), ...output.slice(-FAILURE_OUTPUT_TAIL_LINES)];
}

function runSideOnce(dir: string, options: Options, bundles: string[], outputFile: string) {
    rmSync(outputFile, {force: true});
    if (options.engine === 'jest') {
        const testMatch = options.tests.map((test) => `<rootDir>/${test}`);
        return spawnSync('node', [...NODE_FLAGS, join(dir, 'node_modules/jest/bin/jest.js'), '--runInBand', '--testMatch', ...testMatch], {
            cwd: dir,
            encoding: 'utf8',
            env: {...process.env, NODE_OPTIONS: '--experimental-vm-modules', REASSURE_OUTPUT_FILE: outputFile, REASSURE_SILENT: 'true'},
        });
    }

    // Engine entries print Reassure-style JSON lines; collect them into the same file shape Reassure writes.
    let lastResult: SpawnSyncReturns<string> | undefined;
    for (const bundle of bundles) {
        lastResult = options.engine === 'hermes' ? spawnSync(options.hermesBin, [bundle], {encoding: 'utf8'}) : spawnSync('node', ['--expose-gc', bundle], {encoding: 'utf8'});
        if (lastResult.status !== 0) {
            return lastResult;
        }
        const lines = lastResult.stdout.split('\n').filter((line) => line.startsWith('{"name"'));
        writeFileSync(outputFile, `${lines.join('\n')}\n`, {flag: 'a'});
    }
    if (!lastResult) {
        throw new Error('No engine bundles to run');
    }
    return lastResult;
}

/** One retry: a single stalled run (sleep, a noisy neighbor) shouldn't throw away the rounds collected so far. */
function runSide(side: Side, dir: string, options: Options, bundles: string[], outputFile: string) {
    for (let attempt = 1; attempt <= MAX_RUN_ATTEMPTS; attempt++) {
        const result = runSideOnce(dir, options, bundles, outputFile);
        if (result.status === 0) {
            return;
        }
        const message = `${side} run failed in ${dir} (attempt ${attempt}):\n${describeFailure(result).join('\n')}`;
        if (attempt === MAX_RUN_ATTEMPTS) {
            throw new Error(message);
        }
        console.warn(message);
    }
}

function isMeasureEntry(value: unknown): value is {name: string; meanDuration: number} {
    return typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string' && 'meanDuration' in value && typeof value.meanDuration === 'number';
}

/** Reassure writes one JSON line per measured test; meanDuration already has outliers removed. */
function readMeans(file: string): Map<string, number> {
    const means = new Map<string, number>();
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) {
            continue;
        }
        const entry: unknown = JSON.parse(line);
        if (isMeasureEntry(entry)) {
            // Jest prefixes the describe title; the test's own "[Area] ..." title is the readable part.
            means.set(entry.name.slice(Math.max(0, entry.name.indexOf('['))), entry.meanDuration);
        }
    }
    return means;
}

function getMedian(values: number[]): number {
    const sorted = values.toSorted((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? (sorted.at(middle) ?? 0) : ((sorted.at(middle - 1) ?? 0) + (sorted.at(middle) ?? 0)) / 2;
}

/**
 * Drops pairs far from the rest (beyond 4 robust standard deviations of the median). One stalled run, e.g. 25 ms
 * among 17 ms ones, otherwise widens the interval enough to leave a clear benchmark unclear.
 */
function dropStalledRounds(logRatios: number[]): number[] {
    if (logRatios.length < MIN_ROUNDS_FOR_DROPPING) {
        return logRatios;
    }
    const center = getMedian(logRatios);
    const spread = MAD_TO_STANDARD_DEVIATION * getMedian(logRatios.map((value) => Math.abs(value - center)));
    if (spread === 0) {
        return logRatios;
    }
    return logRatios.filter((value) => Math.abs(value - center) <= STALLED_ROUND_CUTOFF * spread);
}

/** Paired t-interval on log(head/base), so one slow moment on the machine hits both halves of a pair. */
function evaluate(name: string, base: number[], head: number[], threshold: number, minDeltaMs: number): BenchmarkResult {
    const allLogRatios = base.map((baseValue, index) => Math.log((head.at(index) ?? baseValue) / baseValue));
    const logRatios = dropStalledRounds(allLogRatios);
    const count = logRatios.length;
    const mean = logRatios.reduce((sum, value) => sum + value, 0) / count;
    const variance = count > 1 ? logRatios.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (count - 1) : Infinity;
    const margin = (T_95.at(count - 2) ?? 1.96) * Math.sqrt(variance / count);
    const ratioLow = Math.exp(mean - margin);
    const ratioHigh = Math.exp(mean + margin);
    const limit = 1 + threshold;
    const baseMedianMs = getMedian(base);

    // A big percentage of a 1 ms call is still invisible to users, so a regression also has to cost real milliseconds.
    let verdict: Verdict = 'unclear';
    if (ratioLow > limit && (ratioLow - 1) * baseMedianMs > minDeltaMs) {
        verdict = 'regression';
    } else if (ratioHigh < limit || (ratioHigh - 1) * baseMedianMs < minDeltaMs) {
        verdict = 'ok';
    }

    return {name, rounds: count, droppedRounds: allLogRatios.length - count, baseMedianMs, headMedianMs: getMedian(head), ratio: Math.exp(mean), ratioLow, ratioHigh, verdict};
}

function formatPercent(ratio: number): string {
    const percent = (ratio - 1) * 100;
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
}

function toMarkdown(results: BenchmarkResult[], options: Options, elapsedMinutes: number): string {
    const icon: Record<Verdict, string> = {ok: '🟢', regression: '🔴', unclear: '🟡'};
    const rows = results.map(
        (result) =>
            `| ${icon[result.verdict]} ${result.verdict} | ${result.name} | ${result.baseMedianMs.toFixed(2)} | ${result.headMedianMs.toFixed(2)} | ${formatPercent(result.ratio)} | ${((result.ratio - 1) * result.baseMedianMs).toFixed(2)} | ${formatPercent(result.ratioLow)} to ${formatPercent(result.ratioHigh)} | ${result.rounds}${result.droppedRounds ? ` (${result.droppedRounds} dropped)` : ''} |`,
    );
    return [
        `Engine: ${options.engine}. Limit: ${formatPercent(1 + options.threshold)} and ${options.minDeltaMs} ms slower. Elapsed: ${elapsedMinutes.toFixed(1)} min.`,
        '',
        '| Verdict | Benchmark | Base (ms) | Head (ms) | Change | Change (ms) | 95% interval | Rounds |',
        '| --- | --- | ---: | ---: | ---: | ---: | --- | ---: |',
        ...rows,
    ].join('\n');
}

function run() {
    const options = parseOptions(process.argv.slice(2));
    const dirs: Record<Side, string> = {base: options.baseDir, head: options.headDir};
    for (const dir of Object.values(dirs)) {
        if (!existsSync(join(dir, 'node_modules/jest/bin/jest.js'))) {
            throw new Error(`${dir} has no node_modules; install them first`);
        }
        // node_modules holds relative links into the tree (modules/hybrid-app); through a symlink they resolve into
        // another checkout, and the Jest mocks keyed on this tree's paths stop matching.
        if (lstatSync(join(dir, 'node_modules')).isSymbolicLink()) {
            throw new Error(`${dir}/node_modules is a symlink; use a real install or a copy (cp -cR on macOS)`);
        }
        copyHarness(dir);
    }
    mkdirSync(options.outputDir, {recursive: true});
    const bundles: Record<Side, string[]> =
        options.engine === 'jest' ? {base: [], head: []} : {base: prepareBundles('base', dirs.base, options), head: prepareBundles('head', dirs.head, options)};

    // Paired per round: a benchmark only gets a sample when both sides measured it in that round.
    const samples = new Map<string, {base: number[]; head: number[]}>();
    const headOnly = new Set<string>();
    const startedAt = Date.now();
    let results: BenchmarkResult[] = [];

    for (let round = 1; round <= options.maxRounds; round++) {
        // Alternate which side goes first so a warm-up or cool-down trend doesn't favor one side.
        const order: Side[] = round % 2 ? ['base', 'head'] : ['head', 'base'];
        const means: Partial<Record<Side, Map<string, number>>> = {};
        for (const side of order) {
            const outputFile = join(options.outputDir, `${side}-${round}.perf`);
            runSide(side, dirs[side], options, bundles[side], outputFile);
            means[side] = readMeans(outputFile);
        }
        for (const [name, headMean] of means.head ?? []) {
            const baseMean = means.base?.get(name);
            if (baseMean === undefined) {
                headOnly.add(name);
                continue;
            }
            const pairs = samples.get(name) ?? {base: [], head: []};
            pairs.base.push(baseMean);
            pairs.head.push(headMean);
            samples.set(name, pairs);
        }

        results = [...samples].map(([name, pairs]) => evaluate(name, pairs.base, pairs.head, options.threshold, options.minDeltaMs));
        if (results.length === 0) {
            throw new Error(`No benchmark was measured on both sides; check --test and --engine (head only: ${[...headOnly].join(', ') || 'none'})`);
        }
        const elapsedMinutes = (Date.now() - startedAt) / 60000;
        console.log(`Round ${round}: ${results.filter((result) => result.verdict !== 'unclear').length}/${results.length} decided, ${elapsedMinutes.toFixed(1)} min`);

        const allDecided = results.every((result) => result.verdict !== 'unclear');
        if ((round >= options.minRounds && allDecided) || elapsedMinutes >= options.maxMinutes) {
            break;
        }
    }

    const missing = [...headOnly].filter((name) => !samples.has(name));
    const elapsedMinutes = (Date.now() - startedAt) / 60000;
    const markdown = [toMarkdown(results, options, elapsedMinutes), ...(missing.length ? ['', `Only in head (no comparison): ${missing.join(', ')}`] : [])].join('\n');
    writeFileSync(join(options.outputDir, 'results.json'), JSON.stringify({options, results, missing}, null, 2));
    writeFileSync(join(options.outputDir, 'results.md'), markdown);
    console.log(`\n${markdown}`);

    if (results.some((result) => result.verdict === 'regression')) {
        process.exitCode = 1;
    }
}

run();
