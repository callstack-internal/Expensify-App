/**
 * SQLite multiGet Benchmark Screen
 *
 * Tests different query strategies for fetching large batches of records
 * using a separate test database (does NOT touch OnyxDB).
 *
 * All strategies use executeAsync to match the real Onyx code path.
 * Temp table strategy mirrors Fábio's exact reverted implementation
 * (chained executeAsync/executeBatchAsync calls).
 *
 * Access via Test Tools Modal → "Run SQL Benchmark" button.
 */
import Clipboard from '@react-native-clipboard/clipboard';
import React, {useCallback, useRef, useState} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {open} from 'react-native-nitro-sqlite';
import type {NitroSQLiteConnection} from 'react-native-nitro-sqlite';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';

const BENCH_DB_NAME = 'BenchmarkDB';
const TABLE = 'keyvaluepairs';
const COLLECTION_PREFIX = 'reportActions_';
const PREFIXES = ['reportActions_', 'reports_', 'transactions_', 'policies_', 'accounts_'];
const RUNS = 7;
const RECORD_COUNTS = [100, 500, 1000, 5000, 10000];

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
    median: number;
    min: number;
    max: number;
};

// ---------------------------------------------------------------------------
// Test data — matches real ReportAction shape
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
// multiGet strategies — all use executeAsync to match real Onyx code path
// ---------------------------------------------------------------------------

/** Current Onyx implementation: single executeAsync with IN clause */
async function multiGetIN(db: NitroSQLiteConnection, keys: string[]) {
    const placeholders = keys.map(() => '?').join(',');
    const {rows} = await db.executeAsync(`SELECT record_key, valueJSON FROM ${TABLE} WHERE record_key IN (${placeholders})`, keys);
    // eslint-disable-next-line no-underscore-dangle
    return rows?._array ?? [];
}

/** Fábio's reverted implementation: chained executeAsync calls with temp table */
async function multiGetTempTable(db: NitroSQLiteConnection, keys: string[]) {
    const tableName = `temp_multiGet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await db.executeAsync(`CREATE TEMP TABLE ${tableName} (record_key TEXT PRIMARY KEY);`);

    const insertQuery = `INSERT INTO ${tableName} (record_key) VALUES (?);`;
    const insertParams = keys.map((key) => [key]);
    await db.executeBatchAsync([{query: insertQuery, params: insertParams}]);

    const {rows} = await db.executeAsync(
        `SELECT k.record_key, k.valueJSON FROM ${TABLE} AS k INNER JOIN ${tableName} AS t ON k.record_key = t.record_key;`,
    );

    // eslint-disable-next-line no-underscore-dangle
    const result = rows?._array ?? [];

    // Cleanup — fire and forget, matching Fábio's .finally() which doesn't block the return
    db.executeAsync(`DROP TABLE IF EXISTS ${tableName};`);

    return result;
}

/** Chunked IN: split into batches, each via executeAsync */
async function multiGetChunkedIN(db: NitroSQLiteConnection, keys: string[], chunkSize = 500) {
    const allResults: unknown[] = [];
    for (let i = 0; i < keys.length; i += chunkSize) {
        const chunk = keys.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => '?').join(',');
        // eslint-disable-next-line no-await-in-loop -- sequential chunks are intentional
        const {rows} = await db.executeAsync(`SELECT record_key, valueJSON FROM ${TABLE} WHERE record_key IN (${placeholders})`, chunk);
        if (rows) {
            // eslint-disable-next-line no-underscore-dangle
            allResults.push(...rows._array);
        }
    }
    return allResults;
}

/** GLOB: single executeAsync with prefix pattern */
async function multiGetGLOB(db: NitroSQLiteConnection, prefix: string) {
    const {rows} = await db.executeAsync(`SELECT record_key, valueJSON FROM ${TABLE} WHERE record_key GLOB ?`, [`${prefix}*`]);
    // eslint-disable-next-line no-underscore-dangle
    return rows?._array ?? [];
}

/** LIKE: single executeAsync with prefix pattern */
async function multiGetLIKE(db: NitroSQLiteConnection, prefix: string) {
    const {rows} = await db.executeAsync(`SELECT record_key, valueJSON FROM ${TABLE} WHERE record_key LIKE ?`, [`${prefix}%`]);
    // eslint-disable-next-line no-underscore-dangle
    return rows?._array ?? [];
}

// ---------------------------------------------------------------------------
// Async benchmark runner
// ---------------------------------------------------------------------------

async function runStrategyAsync(fn: () => Promise<unknown>, runs: number): Promise<{median: number; min: number; max: number}> {
    // 2 warmup
    await fn();
    await fn();

    const times: number[] = [];
    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        // eslint-disable-next-line no-await-in-loop -- sequential runs required for accurate timing
        await fn();
        times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    return {
        median: times.at(Math.floor(times.length / 2)) ?? 0,
        min: times.at(0) ?? 0,
        max: times.at(-1) ?? 0,
    };
}

// ---------------------------------------------------------------------------
// Benchmark runner for a single record count
// ---------------------------------------------------------------------------

async function benchmarkForCount(db: NitroSQLiteConnection, count: number): Promise<BenchResult[]> {
    db.execute(`DELETE FROM ${TABLE}`);
    const allKeys: Record<string, string[]> = {};
    for (const prefix of PREFIXES) {
        allKeys[prefix] = seedDB(db, count, prefix);
    }
    const targetKeys = allKeys[COLLECTION_PREFIX];

    const strategies: Array<{name: string; fn: () => Promise<unknown>}> = [
        {name: 'IN clause', fn: () => multiGetIN(db, targetKeys)},
        {name: 'Temp table', fn: () => multiGetTempTable(db, targetKeys)},
        {name: 'Chunked IN', fn: () => multiGetChunkedIN(db, targetKeys)},
        {name: 'GLOB', fn: () => multiGetGLOB(db, COLLECTION_PREFIX)},
        {name: 'LIKE', fn: () => multiGetLIKE(db, COLLECTION_PREFIX)},
    ];

    const stepResults: BenchResult[] = [];
    for (const strat of strategies) {
        // eslint-disable-next-line no-await-in-loop -- sequential strategies prevent interference
        const r = await runStrategyAsync(strat.fn, RUNS);
        stepResults.push({strategy: strat.name, count, ...r});
    }
    return stepResults;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SQLiteBenchmark() {
    const [results, setResults] = useState<BenchResult[]>([]);
    const [running, setRunning] = useState(false);
    const [status, setStatus] = useState('Ready — tap to run');
    const [runCounter, setRunCounter] = useState(0);
    const pendingRef = useRef<BenchResult[]>([]);

    const startBenchmarks = useCallback(() => {
        if (Platform.OS === 'web') {
            setStatus('SQLite benchmarks only run on iOS/Android');
            return;
        }
        setRunning(true);
        setResults([]);
        pendingRef.current = [];
        setStatus('Opening database...');

        const runAll = async () => {
            let db: NitroSQLiteConnection | null = null;
            try {
                db = openBenchDB();

                for (const count of RECORD_COUNTS) {
                    setStatus(`Seeding & benchmarking ${count} records...`);
                    // Yield to let React flush the status update
                    // eslint-disable-next-line no-await-in-loop -- sequential record counts are intentional
                    await new Promise<void>((resolve) => {
                        requestAnimationFrame(() => resolve());
                    });

                    // eslint-disable-next-line no-await-in-loop
                    const stepResults = await benchmarkForCount(db, count);
                    pendingRef.current.push(...stepResults);
                    setResults([...pendingRef.current]);
                }

                // Cleanup
                db.execute(`DROP TABLE IF EXISTS ${TABLE}`);
                db.close();
                db.delete();
                db = null;

                setRunCounter((prev) => prev + 1);
                setStatus(`Done! ${RECORD_COUNTS.length} sizes x 5 strategies (async)`);

                const jsonOutput = JSON.stringify(
                    {
                        platform: Platform.OS,
                        timestamp: new Date().toISOString(),
                        config: {runs: RUNS, collections: PREFIXES.length, recordCounts: RECORD_COUNTS, mode: 'executeAsync'},
                        results: pendingRef.current,
                    },
                    null,
                    2,
                );
                // eslint-disable-next-line no-console
                console.log(`\n===== SQLITE_BENCHMARK_JSON_START =====\n${jsonOutput}\n===== SQLITE_BENCHMARK_JSON_END =====\n`);
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setStatus(`Error: ${msg}`);
                // eslint-disable-next-line no-console
                console.error('Benchmark error:', e);
                if (db) {
                    try {
                        db.close();
                        db.delete();
                    } catch {
                        // ignore
                    }
                }
            } finally {
                setRunning(false);
            }
        };

        runAll();
    }, []);

    const copyResults = useCallback(() => {
        const jsonOutput = JSON.stringify(
            {
                platform: Platform.OS,
                timestamp: new Date().toISOString(),
                run: runCounter,
                config: {runs: RUNS, collections: PREFIXES.length, recordCounts: RECORD_COUNTS, mode: 'executeAsync'},
                results,
            },
            null,
            2,
        );
        Clipboard.setString(jsonOutput);
        setStatus('Results copied to clipboard!');
    }, [results, runCounter]);

    // Group results by count
    const grouped = new Map<number, BenchResult[]>();
    for (const r of results) {
        const list = grouped.get(r.count) ?? [];
        if (!grouped.has(r.count)) {
            grouped.set(r.count, list);
        }
        list.push(r);
    }

    return (
        <View>
            <Text style={localStyles.title}>SQLite multiGet Benchmark</Text>
            <Text style={localStyles.sub}>
                All async (executeAsync). {RUNS} runs, median. {PREFIXES.length} collections x N each.
            </Text>

            <PressableWithFeedback
                accessibilityRole="button"
                accessibilityLabel={running ? 'Running benchmarks' : 'Run benchmarks'}
                style={[localStyles.btn, running && localStyles.btnOff]}
                onPress={startBenchmarks}
                disabled={running}
            >
                <Text style={localStyles.btnTxt}>{running ? 'Running...' : 'Run Benchmarks'}</Text>
            </PressableWithFeedback>

            {results.length > 0 && !running && (
                <PressableWithFeedback
                    accessibilityRole="button"
                    accessibilityLabel="Copy results as JSON"
                    style={[localStyles.btn, {backgroundColor: '#28a745'}]}
                    onPress={copyResults}
                >
                    <Text style={localStyles.btnTxt}>Copy Results as JSON</Text>
                </PressableWithFeedback>
            )}

            <Text style={localStyles.status}>{status}</Text>

            {Array.from(grouped.entries()).map(([count, gr]) => {
                const baseline = gr.find((r) => r.strategy === 'IN clause')?.median ?? 1;
                return (
                    <View
                        key={count}
                        style={localStyles.group}
                    >
                        <Text style={localStyles.gTitle}>
                            {count} records (DB: {count * PREFIXES.length})
                        </Text>
                        <View style={localStyles.hRow}>
                            <Text style={[localStyles.c, localStyles.sc, localStyles.hTxt]}>Strategy</Text>
                            <Text style={[localStyles.c, localStyles.hTxt]}>Median</Text>
                            <Text style={[localStyles.c, localStyles.hTxt]}>Min</Text>
                            <Text style={[localStyles.c, localStyles.hTxt]}>Max</Text>
                            <Text style={[localStyles.c, localStyles.hTxt]}>vs IN</Text>
                        </View>
                        {gr.map((r) => {
                            const diff = ((r.median - baseline) / baseline) * 100;
                            const isBase = r.strategy === 'IN clause';
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
                                    <Text style={localStyles.c}>{r.max.toFixed(2)}</Text>
                                    <Text style={[localStyles.c, {color: clr}]}>{diffStr}</Text>
                                </View>
                            );
                        })}
                    </View>
                );
            })}
        </View>
    );
}

SQLiteBenchmark.displayName = 'SQLiteBenchmark';

export default SQLiteBenchmark;
