/**
 * SQLite multiGet Benchmark Screen
 *
 * Measures query strategies in two phases to isolate SQL performance from JSON.parse noise:
 *   Phase 1 (SQL only): executeAsync → return raw _array (measures query + bridge overhead)
 *   Phase 2 (Full pipeline): executeAsync → JSON.parse each row (measures total cost as in real Onyx)
 *
 * Reports "best of N" (minimum) — GC/system load can only ADD time, never subtract,
 * so the minimum is the most reliable indicator of true performance.
 *
 * Access via Test Tools Modal.
 */
import Clipboard from '@react-native-clipboard/clipboard';
import React, {useCallback, useState} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {open} from 'react-native-nitro-sqlite';
import type {NitroSQLiteConnection} from 'react-native-nitro-sqlite';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';

const BENCH_DB_NAME = 'BenchmarkDB';
const TABLE = 'keyvaluepairs';
const COLLECTION_PREFIX = 'reportActions_';
const PREFIXES = ['reportActions_', 'reports_', 'transactions_', 'policies_', 'accounts_'];
const RUNS = 40;
const PAUSE_BETWEEN_STRATEGIES_MS = 100;
const RECORD_COUNTS = [500, 1000, 5000, 10000];

const localStyles = StyleSheet.create({
    title: {fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 2},
    sub: {fontSize: 11, color: '#666', marginBottom: 12},
    btn: {backgroundColor: '#0366d6', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 8},
    btnOff: {backgroundColor: '#999'},
    btnTxt: {color: '#fff', fontWeight: '600', fontSize: 14},
    status: {fontSize: 11, color: '#666', marginBottom: 12, fontStyle: 'italic'},
    group: {marginBottom: 16, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10},
    gTitle: {fontSize: 13, fontWeight: '600', marginBottom: 6},
    hRow: {flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingBottom: 3, marginBottom: 3},
    hTxt: {fontWeight: '600', fontSize: 10},
    row: {flexDirection: 'row', paddingVertical: 2},
    c: {flex: 1, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'},
    sc: {flex: 1.5},
});

type BenchResult = {
    strategy: string;
    count: number;
    bestOf: number;
    median: number;
    min: number;
    max: number;
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function createRecord(index: number): string {
    return JSON.stringify({
        actionName: `action_${index}`,
        reportActionID: String(index),
        actorAccountID: index,
        person: [{type: 'TEXT', style: 'strong', text: `User ${index}`}],
        created: new Date(Date.now() - Math.random() * 1e10).toISOString(),
        message: [{type: 'COMMENT', html: `<p>Message ${index}</p>`, text: `Message ${index}`, isEdited: index % 3 === 0}],
        originalMessage: {html: `<p>Original ${index}</p>`, lastModified: new Date().toISOString()},
        avatar: `avatar_${index}.png`,
        automatic: false,
        shouldShow: true,
        lastModified: new Date().toISOString(),
        pendingAction: null,
        delegateAccountID: index,
        errors: {},
        isAttachmentOnly: false,
    });
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

function openBenchDB(): NitroSQLiteConnection {
    const db = open({name: BENCH_DB_NAME});
    db.execute(`CREATE TABLE IF NOT EXISTS ${TABLE} (record_key TEXT NOT NULL PRIMARY KEY, valueJSON JSON NOT NULL) WITHOUT ROWID;`);
    db.execute('PRAGMA CACHE_SIZE=-20000;');
    db.execute('PRAGMA synchronous=NORMAL;');
    db.execute('PRAGMA journal_mode=WAL;');
    return db;
}

function seedDB(db: NitroSQLiteConnection, count: number, prefix: string): string[] {
    const keys: string[] = [];
    const params: string[][] = [];
    for (let i = 0; i < count; i++) {
        const key = `${prefix}${i}`;
        keys.push(key);
        params.push([key, createRecord(i)]);
    }
    db.executeBatch([{query: `REPLACE INTO ${TABLE} (record_key, valueJSON) VALUES (?, ?)`, params}]);
    return keys;
}

// ---------------------------------------------------------------------------
// Strategy definitions — each returns a function for SQL-only and full pipeline
// ---------------------------------------------------------------------------

type StrategyFn = () => Promise<unknown>;

function makeStrategies(db: NitroSQLiteConnection, keys: string[], prefix: string) {
    // Return raw rows — JSON.parse cost is identical for all strategies so we exclude it
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const getRows = (rows: {_array: unknown[]} | undefined) => {
        // eslint-disable-next-line no-underscore-dangle
        return rows?._array ?? [];
    };

    const inClause: StrategyFn = async () => {
        const placeholders = keys.map(() => '?').join(',');
        const {rows} = await db.executeAsync(`SELECT record_key, valueJSON FROM ${TABLE} WHERE record_key IN (${placeholders})`, keys);
        return getRows(rows);
    };

    const tempTable: StrategyFn = async () => {
        const tableName = `temp_multiGet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await db.executeAsync(`CREATE TEMP TABLE ${tableName} (record_key TEXT PRIMARY KEY);`);
        await db.executeBatchAsync([{query: `INSERT INTO ${tableName} (record_key) VALUES (?);`, params: keys.map((k) => [k])}]);
        const {rows} = await db.executeAsync(`SELECT k.record_key, k.valueJSON FROM ${TABLE} AS k INNER JOIN ${tableName} AS t ON k.record_key = t.record_key;`);
        const result = getRows(rows);
        db.executeAsync(`DROP TABLE IF EXISTS ${tableName};`);
        return result;
    };

    const makeChunkedIN =
        (chunkSize: number): StrategyFn =>
        async () => {
            const allResults: unknown[] = [];
            for (let i = 0; i < keys.length; i += chunkSize) {
                const chunk = keys.slice(i, i + chunkSize);
                const placeholders = chunk.map(() => '?').join(',');
                // eslint-disable-next-line no-await-in-loop
                const {rows} = await db.executeAsync(`SELECT record_key, valueJSON FROM ${TABLE} WHERE record_key IN (${placeholders})`, chunk);
                allResults.push(...getRows(rows));
            }
            return allResults;
        };

    /** json_each JOIN: pass all keys as a single JSON array, JOIN against json_each() virtual table */
    const jsonEachJoin: StrategyFn = async () => {
        const jsonArray = JSON.stringify(keys);
        const {rows} = await db.executeAsync(`SELECT kv.record_key, kv.valueJSON FROM ${TABLE} kv INNER JOIN json_each(?) je ON kv.record_key = je.value`, [jsonArray]);
        return getRows(rows);
    };

    /** json_each subselect: keys as JSON array, used in WHERE IN subquery */
    const jsonEachSubselect: StrategyFn = async () => {
        const jsonArray = JSON.stringify(keys);
        const {rows} = await db.executeAsync(`SELECT record_key, valueJSON FROM ${TABLE} WHERE record_key IN (SELECT value FROM json_each(?))`, [jsonArray]);
        return getRows(rows);
    };

    const glob: StrategyFn = async () => {
        const {rows} = await db.executeAsync(`SELECT record_key, valueJSON FROM ${TABLE} WHERE record_key GLOB ?`, [`${prefix}*`]);
        return getRows(rows);
    };

    return [
        {name: 'IN clause', fn: inClause},
        {name: 'Temp table', fn: tempTable},
        {name: 'Chunk 500', fn: makeChunkedIN(500)},
        {name: 'Chunk 1000', fn: makeChunkedIN(1000)},
        {name: 'json_each JOIN', fn: jsonEachJoin},
        {name: 'json_each SUB', fn: jsonEachSubselect},
        {name: 'GLOB', fn: glob},
    ];
}

// ---------------------------------------------------------------------------
// Benchmark runner — reports min (best of N) and median
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-promise-executor-return
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Force GC if available (Hermes exposes this) so it doesn't fire randomly during measurement */
function forceGC() {
    // @ts-expect-error -- HermesInternal is a global on Hermes engine
    if (typeof HermesInternal === 'undefined' || typeof HermesInternal.collectGarbage !== 'function') {
        return;
    }
    // @ts-expect-error -- not in TS types
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    HermesInternal?.collectGarbage();
}

async function runStrategyAsync(fn: StrategyFn, runs: number): Promise<{bestOf: number; median: number; min: number; max: number}> {
    // 3 warmup
    await fn();
    await fn();
    await fn();

    const times: number[] = [];
    for (let i = 0; i < runs; i++) {
        forceGC();
        const start = performance.now();
        // eslint-disable-next-line no-await-in-loop
        await fn();
        times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);

    const median = times.at(Math.floor(times.length / 2)) ?? 0;

    return {
        bestOf: times.at(0) ?? 0,
        median,
        min: times.at(0) ?? 0,
        max: times.at(-1) ?? 0,
    };
}

// ---------------------------------------------------------------------------
// Run both phases for a single record count
// ---------------------------------------------------------------------------

async function benchmarkForCount(db: NitroSQLiteConnection, count: number): Promise<BenchResult[]> {
    db.execute(`DELETE FROM ${TABLE}`);
    const allKeys: Record<string, string[]> = {};
    for (const pfx of PREFIXES) {
        allKeys[pfx] = seedDB(db, count, pfx);
    }
    const targetKeys = allKeys[COLLECTION_PREFIX];

    const results: BenchResult[] = [];

    // SQL only — JSON.parse cost is identical for all strategies so we exclude it
    const strategies = makeStrategies(db, targetKeys, COLLECTION_PREFIX);
    for (const strat of strategies) {
        // eslint-disable-next-line no-await-in-loop
        await pause(PAUSE_BETWEEN_STRATEGIES_MS);
        // eslint-disable-next-line no-await-in-loop
        const r = await runStrategyAsync(strat.fn, RUNS);
        results.push({strategy: strat.name, count, ...r});
    }

    return results;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MULTI_RUN_COUNT = 6;

/** Run one full benchmark pass (all record counts, all strategies). Returns results array. */
async function runSinglePass(setStatus: (s: string) => void, passNumber?: number): Promise<BenchResult[]> {
    const passLabel = passNumber != null ? ` (pass ${passNumber})` : '';
    const db = openBenchDB();
    const passResults: BenchResult[] = [];

    try {
        for (const count of RECORD_COUNTS) {
            setStatus(`Benchmarking ${count} records${passLabel}...`);
            // eslint-disable-next-line no-await-in-loop
            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => resolve());
            });

            // eslint-disable-next-line no-await-in-loop
            const stepResults = await benchmarkForCount(db, count);
            passResults.push(...stepResults);
        }
    } finally {
        try {
            db.execute(`DROP TABLE IF EXISTS ${TABLE}`);
            db.close();
            db.delete();
        } catch {
            // ignore cleanup errors
        }
    }

    return passResults;
}

function SQLiteBenchmark() {
    const [results, setResults] = useState<BenchResult[]>([]);
    const [allRuns, setAllRuns] = useState<BenchResult[][]>([]);
    const [running, setRunning] = useState(false);
    const [status, setStatus] = useState('Ready — tap to run');

    const startSingleRun = useCallback(() => {
        if (Platform.OS === 'web') {
            setStatus('SQLite benchmarks only run on iOS/Android');
            return;
        }
        setRunning(true);
        setResults([]);
        setAllRuns([]);

        const run = async () => {
            try {
                const passResults = await runSinglePass(setStatus);
                setResults(passResults);
                setAllRuns([passResults]);
                setStatus(`Done! ${RECORD_COUNTS.length} sizes x 7 strategies`);
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setStatus(`Error: ${msg}`);
                // eslint-disable-next-line no-console
                console.error('Benchmark error:', e);
            } finally {
                setRunning(false);
            }
        };

        run();
    }, []);

    const startMultiRun = useCallback(() => {
        if (Platform.OS === 'web') {
            setStatus('SQLite benchmarks only run on iOS/Android');
            return;
        }
        setRunning(true);
        setResults([]);
        setAllRuns([]);

        const run = async () => {
            const collectedRuns: BenchResult[][] = [];
            try {
                for (let i = 0; i < MULTI_RUN_COUNT; i++) {
                    // eslint-disable-next-line no-await-in-loop
                    const passResults = await runSinglePass(setStatus, i + 1);
                    collectedRuns.push(passResults);
                    // Show latest run results on screen
                    setResults(passResults);
                    setAllRuns([...collectedRuns]);
                }
                setStatus(`Done! ${MULTI_RUN_COUNT} runs complete — tap Copy All to export`);
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setStatus(`Error: ${msg}`);
                // eslint-disable-next-line no-console
                console.error('Benchmark error:', e);
            } finally {
                setRunning(false);
            }
        };

        run();
    }, []);

    const copyResults = useCallback(() => {
        const jsonOutput = JSON.stringify(
            {
                platform: Platform.OS,
                timestamp: new Date().toISOString(),
                totalRuns: allRuns.length,
                config: {runsPerPass: RUNS, collections: PREFIXES.length, recordCounts: RECORD_COUNTS},
                runs: allRuns.map((passResults, i) => ({run: i + 1, results: passResults})),
            },
            null,
            2,
        );
        Clipboard.setString(jsonOutput);
        setStatus(`Copied ${allRuns.length} run(s) to clipboard!`);
    }, [allRuns]);

    // Group by count
    const grouped = new Map<number, BenchResult[]>();
    for (const r of results) {
        const list = grouped.get(r.count) ?? [];
        if (!grouped.has(r.count)) {
            grouped.set(r.count, list);
        }
        list.push(r);
    }

    const renderTable = (rows: BenchResult[], baselineStrategy: string) => {
        const baselineMedian = rows.find((r) => r.strategy === baselineStrategy)?.median ?? 1;
        return (
            <>
                <View style={localStyles.hRow}>
                    <Text style={[localStyles.c, localStyles.sc, localStyles.hTxt]}>Strategy</Text>
                    <Text style={[localStyles.c, localStyles.hTxt]}>Median</Text>
                    <Text style={[localStyles.c, localStyles.hTxt]}>Best</Text>
                    <Text style={[localStyles.c, localStyles.hTxt]}>vs IN</Text>
                </View>
                {rows.map((r) => {
                    const diff = ((r.median - baselineMedian) / baselineMedian) * 100;
                    const isBase = r.strategy === baselineStrategy;
                    const diffStr = isBase ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
                    // eslint-disable-next-line no-nested-ternary
                    const clr = isBase ? '#666' : diff < -5 ? '#2d8a4e' : diff > 5 ? '#d32f2f' : '#666';
                    return (
                        <View
                            key={r.strategy}
                            style={localStyles.row}
                        >
                            <Text style={[localStyles.c, localStyles.sc]}>{r.strategy}</Text>
                            <Text style={localStyles.c}>{r.median.toFixed(2)}</Text>
                            <Text style={localStyles.c}>{r.min.toFixed(2)}</Text>
                            <Text style={[localStyles.c, {color: clr}]}>{diffStr}</Text>
                        </View>
                    );
                })}
            </>
        );
    };

    return (
        <View>
            <Text style={localStyles.title}>SQLite multiGet Benchmark</Text>
            <Text style={localStyles.sub}>
                SQL query only (JSON.parse excluded — identical cost for all strategies).{'\n'}
                {RUNS} runs, median. {PREFIXES.length} collections x N records.
            </Text>

            <PressableWithFeedback
                accessibilityRole="button"
                accessibilityLabel="Run once"
                style={[localStyles.btn, running && localStyles.btnOff]}
                onPress={startSingleRun}
                disabled={running}
            >
                <Text style={localStyles.btnTxt}>{running ? 'Running...' : 'Run 1x'}</Text>
            </PressableWithFeedback>

            <PressableWithFeedback
                accessibilityRole="button"
                accessibilityLabel={`Run ${MULTI_RUN_COUNT} times`}
                style={[localStyles.btn, {backgroundColor: '#6f42c1'}, running && localStyles.btnOff]}
                onPress={startMultiRun}
                disabled={running}
            >
                <Text style={localStyles.btnTxt}>{running ? 'Running...' : `Run ${MULTI_RUN_COUNT}x + Copy`}</Text>
            </PressableWithFeedback>

            {allRuns.length > 0 && !running && (
                <PressableWithFeedback
                    accessibilityRole="button"
                    accessibilityLabel="Copy all results as JSON"
                    style={[localStyles.btn, {backgroundColor: '#28a745'}]}
                    onPress={copyResults}
                >
                    <Text style={localStyles.btnTxt}>Copy All ({allRuns.length} runs)</Text>
                </PressableWithFeedback>
            )}

            <Text style={localStyles.status}>{status}</Text>

            {Array.from(grouped.entries()).map(([count, rows]) => (
                <View
                    key={count}
                    style={localStyles.group}
                >
                    <Text style={localStyles.gTitle}>
                        {count} records (DB: {count * PREFIXES.length})
                    </Text>
                    {renderTable(rows, 'IN clause')}
                </View>
            ))}
        </View>
    );
}

SQLiteBenchmark.displayName = 'SQLiteBenchmark';

export default SQLiteBenchmark;
