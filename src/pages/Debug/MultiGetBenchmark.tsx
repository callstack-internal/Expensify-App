/**
 * MultiGet Real Data Benchmark
 *
 * Measures Storage.multiGet on real OnyxDB collections for each SQL strategy.
 * Toggle which collections to include, then tap "Run All Strategies".
 *
 * Access via Test Tools Modal.
 */
import Clipboard from '@react-native-clipboard/clipboard';
import React, {useCallback, useRef, useState} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
// eslint-disable-next-line no-restricted-imports
import storage from 'react-native-onyx/dist/storage';
// eslint-disable-next-line no-restricted-imports
import {setMultiGetStrategy, explainQueryPlan} from 'react-native-onyx/dist/storage/providers/SQLiteProvider';
import type {MultiGetStrategy} from 'react-native-onyx/dist/storage/providers/SQLiteProvider';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';

const RUNS = 20;
const LOOPS = 3;
const PAUSE_BETWEEN_COLLECTIONS_MS = 300;

// Hardcoded collections — toggle which ones to include in the benchmark
const ALL_COLLECTIONS = [
    'transactions_',
    'reportActions_',
    'report_',
    'reportNameValuePairs_',
    'transactionViolations_',
];

const STRATEGIES: Array<{key: MultiGetStrategy; label: string}> = [
    {key: 'in_clause', label: 'IN clause'},
    {key: 'in_clause_no_parse', label: 'IN (no parse)'},
    {key: 'json_each_join', label: 'json_each JOIN'},
    {key: 'chunked_500', label: 'Chunk 500'},
    {key: 'temp_table', label: 'Temp table'},
];

type CollectionResult = {
    prefix: string;
    keyCount: number;
    median: number;
    min: number;
    max: number;
};

type AllResults = Partial<Record<MultiGetStrategy, CollectionResult[]>>;
type SizeResult = {prefix: string; keyCount: number; avgKB: number; maxKB: number; avgKeyLen: number; sampleKey: string};

const localStyles = StyleSheet.create({
    title: {fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 2},
    sub: {fontSize: 11, color: '#666', marginBottom: 8},
    sectionLabel: {fontSize: 11, fontWeight: '600', color: '#333', marginBottom: 4, marginTop: 8},
    toggleRow: {flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8, gap: 6},
    toggle: {paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#0366d6'},
    toggleOn: {backgroundColor: '#0366d6'},
    toggleOff: {backgroundColor: '#fff'},
    toggleTxtOn: {color: '#fff', fontSize: 11, fontWeight: '600'},
    toggleTxtOff: {color: '#0366d6', fontSize: 11},
    btn: {backgroundColor: '#0366d6', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 8},
    btnAll: {backgroundColor: '#e36209', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 8},
    btnGray: {backgroundColor: '#6c757d', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 8},
    btnOff: {backgroundColor: '#999'},
    btnTxt: {color: '#fff', fontWeight: '600', fontSize: 14},
    status: {fontSize: 11, color: '#666', marginBottom: 12, fontStyle: 'italic'},
    group: {marginBottom: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10},
    groupTitle: {fontSize: 12, fontWeight: '600', marginBottom: 6, color: '#333'},
    row: {flexDirection: 'row', paddingVertical: 2},
    c: {flex: 1, fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'},
    cWide: {flex: 1.8, fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'},
    hRow: {flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingBottom: 3, marginBottom: 4},
    hTxt: {fontWeight: '600', fontSize: 10},
});

// eslint-disable-next-line no-promise-executor-return
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function getKeysForPrefix(prefix: string): Promise<string[]> {
    const allKeys = await storage.getAllKeys();
    return allKeys.filter((k) => k.startsWith(prefix));
}

async function measureCollection(keys: string[], prefix: string): Promise<CollectionResult> {
    await storage.multiGet(keys);
    await storage.multiGet(keys);
    await storage.multiGet(keys);

    const loopMedians: number[] = [];
    let overallMin = Infinity;
    let overallMax = 0;

    for (let loop = 0; loop < LOOPS; loop++) {
        const times: number[] = [];
        for (let i = 0; i < RUNS; i++) {
            const start = performance.now();
            // eslint-disable-next-line no-await-in-loop
            await storage.multiGet(keys);
            times.push(performance.now() - start);
        }
        times.sort((a, b) => a - b);
        loopMedians.push(times.at(Math.floor(times.length / 2)) ?? 0);
        overallMin = Math.min(overallMin, times.at(0) ?? 0);
        overallMax = Math.max(overallMax, times.at(-1) ?? 0);
        // eslint-disable-next-line no-await-in-loop
        await pause(100);
    }

    loopMedians.sort((a, b) => a - b);
    return {
        prefix,
        keyCount: keys.length,
        median: loopMedians.at(Math.floor(loopMedians.length / 2)) ?? 0,
        min: overallMin,
        max: overallMax,
    };
}

function MultiGetBenchmark() {
    const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set(ALL_COLLECTIONS));
    const [allResults, setAllResults] = useState<AllResults>({});
    const [sizeResults, setSizeResults] = useState<SizeResult[]>([]);
    const [running, setRunning] = useState(false);
    const [status, setStatus] = useState('Ready');
    const allResultsRef = useRef<AllResults>({});

    const toggleCollection = useCallback((prefix: string) => {
        setSelectedCollections((prev) => {
            const next = new Set(prev);
            if (next.has(prefix)) {
                next.delete(prefix);
            } else {
                next.add(prefix);
            }
            return next;
        });
    }, []);

    const runStrategy = useCallback(
        async (strategy: MultiGetStrategy) => {
            const label = STRATEGIES.find((s) => s.key === strategy)?.label ?? strategy;
            setMultiGetStrategy(strategy);

            const collections = ALL_COLLECTIONS.filter((p) => selectedCollections.has(p));
            const strategyResults: CollectionResult[] = [];

            for (const prefix of collections) {
                setStatus(`[${label}] Loading ${prefix}...`);
                // eslint-disable-next-line no-await-in-loop
                const keys = await getKeysForPrefix(prefix);
                if (keys.length === 0) {
                    continue;
                }
                setStatus(`[${label}] ${prefix} (${keys.length} keys)...`);
                // eslint-disable-next-line no-await-in-loop
                await new Promise<void>((resolve) => {
                    requestAnimationFrame(() => resolve());
                });
                // eslint-disable-next-line no-await-in-loop
                await pause(PAUSE_BETWEEN_COLLECTIONS_MS);
                // eslint-disable-next-line no-await-in-loop
                const r = await measureCollection(keys, prefix);
                strategyResults.push(r);
            }

            allResultsRef.current = {...allResultsRef.current, [strategy]: strategyResults};
            setAllResults({...allResultsRef.current});
            setMultiGetStrategy('in_clause');
        },
        [selectedCollections],
    );

    const runAll = useCallback(() => {
        setRunning(true);
        setAllResults({});
        allResultsRef.current = {};

        const run = async () => {
            for (const strat of STRATEGIES) {
                // eslint-disable-next-line no-await-in-loop
                await runStrategy(strat.key);
            }
            setStatus(`All ${STRATEGIES.length} strategies complete!`);
        };

        run()
            .catch((e) => setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`))
            .finally(() => setRunning(false));
    }, [runStrategy]);

    const runSingle = useCallback(
        (strategy: MultiGetStrategy) => {
            setRunning(true);
            runStrategy(strategy)
                .then(() => setStatus('Done!'))
                .catch((e) => setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`))
                .finally(() => setRunning(false));
        },
        [runStrategy],
    );

    const runExplainQueryPlan = useCallback(() => {
        setRunning(true);
        setStatus('Running EXPLAIN QUERY PLAN...');

        const run = async () => {
            const output: Record<string, unknown> = {};
            const collections = ALL_COLLECTIONS.filter((p) => selectedCollections.has(p));
            for (const prefix of collections) {
                // eslint-disable-next-line no-await-in-loop
                const keys = await getKeysForPrefix(prefix);
                if (keys.length === 0) {
                    continue;
                }
                // Use ALL keys — query planner makes different decisions based on actual count
                // eslint-disable-next-line no-await-in-loop
                const plans = await explainQueryPlan(keys);
                output[prefix] = {keyCount: keys.length, plans};
            }
            const json = JSON.stringify({platform: Platform.OS, timestamp: new Date().toISOString(), queryPlans: output}, null, 2);
            Clipboard.setString(json);
            setStatus('Query plans copied to clipboard!');
            // eslint-disable-next-line no-console
            console.log('EXPLAIN QUERY PLAN:\n', json);
        };

        run()
            .catch((e) => setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`))
            .finally(() => setRunning(false));
    }, [selectedCollections]);

    const inspectSizes = useCallback(() => {
        setRunning(true);
        setSizeResults([]);
        setStatus('Inspecting value sizes...');

        const run = async () => {
            const collections = ALL_COLLECTIONS.filter((p) => selectedCollections.has(p));
            const results: SizeResult[] = [];
            for (const prefix of collections) {
                // eslint-disable-next-line no-await-in-loop
                const keys = await getKeysForPrefix(prefix);
                if (keys.length === 0) {
                    continue;
                }
                const step = Math.max(1, Math.floor(keys.length / 200));
                const sampleKeys = keys.filter((_, i) => i % step === 0).slice(0, 200);
                // eslint-disable-next-line no-await-in-loop
                const pairs = await storage.multiGet(sampleKeys);
                const sizes = pairs.map(([, v]) => JSON.stringify(v).length);
                const avg = sizes.reduce((s, n) => s + n, 0) / sizes.length;
                const max = Math.max(...sizes);
                const avgKeyLen = Math.round(sampleKeys.reduce((s, k) => s + k.length, 0) / sampleKeys.length);
                results.push({prefix, keyCount: keys.length, avgKB: Math.round((avg / 1024) * 10) / 10, maxKB: Math.round((max / 1024) * 10) / 10, avgKeyLen, sampleKey: sampleKeys.at(0) ?? ''});
                setSizeResults([...results]);
            }
            setStatus('Done inspecting sizes.');
        };

        run()
            .catch((e) => setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`))
            .finally(() => setRunning(false));
    }, [selectedCollections]);

    const copySizeResults = useCallback(() => {
        Clipboard.setString(JSON.stringify({platform: Platform.OS, timestamp: new Date().toISOString(), valueSizes: sizeResults}, null, 2));
        setStatus('Sizes copied!');
    }, [sizeResults]);

    const copyResults = useCallback(() => {
        Clipboard.setString(
            JSON.stringify(
                {
                    platform: Platform.OS,
                    timestamp: new Date().toISOString(),
                    config: {runs: RUNS, loops: LOOPS, collections: Array.from(selectedCollections)},
                    results: allResults,
                },
                null,
                2,
            ),
        );
        setStatus('Copied!');
    }, [allResults, selectedCollections]);

    const measuredPrefixes = ALL_COLLECTIONS.filter((p) => selectedCollections.has(p) && Object.values(allResults).some((r) => r?.some((res) => res.prefix === p)));
    const baseline = allResults.in_clause;
    const baselineMap = new Map(baseline?.map((r) => [r.prefix, r]) ?? []);

    return (
        <View>
            <Text style={localStyles.title}>multiGet — Real Data Benchmark</Text>
            <Text style={localStyles.sub}>
                Real OnyxDB. {LOOPS}×{RUNS} runs, median of medians.
            </Text>

            <Text style={localStyles.sectionLabel}>Collections to test:</Text>
            <View style={localStyles.toggleRow}>
                {ALL_COLLECTIONS.map((prefix) => {
                    const on = selectedCollections.has(prefix);
                    return (
                        <PressableWithFeedback
                            key={prefix}
                            accessibilityRole="button"
                            accessibilityLabel={prefix}
                            style={[localStyles.toggle, on ? localStyles.toggleOn : localStyles.toggleOff]}
                            onPress={() => toggleCollection(prefix)}
                            disabled={running}
                        >
                            <Text style={on ? localStyles.toggleTxtOn : localStyles.toggleTxtOff}>{prefix.replace(/_$/, '')}</Text>
                        </PressableWithFeedback>
                    );
                })}
            </View>

            <PressableWithFeedback
                accessibilityRole="button"
                accessibilityLabel="Run all strategies"
                style={[localStyles.btnAll, running && localStyles.btnOff]}
                onPress={runAll}
                disabled={running}
            >
                <Text style={localStyles.btnTxt}>{running ? 'Running...' : `Run All ${STRATEGIES.length} Strategies`}</Text>
            </PressableWithFeedback>

            {STRATEGIES.map((s) => (
                <PressableWithFeedback
                    key={s.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Run ${s.label}`}
                    style={[localStyles.btn, running && localStyles.btnOff]}
                    onPress={() => runSingle(s.key)}
                    disabled={running}
                >
                    <Text style={localStyles.btnTxt}>{running ? '...' : s.label}</Text>
                </PressableWithFeedback>
            ))}

            <PressableWithFeedback
                accessibilityRole="button"
                accessibilityLabel="Inspect value sizes"
                style={[localStyles.btnGray, running && localStyles.btnOff]}
                onPress={inspectSizes}
                disabled={running}
            >
                <Text style={localStyles.btnTxt}>Inspect Value Sizes</Text>
            </PressableWithFeedback>

            <PressableWithFeedback
                accessibilityRole="button"
                accessibilityLabel="Explain query plan"
                style={[localStyles.btnGray, running && localStyles.btnOff]}
                onPress={runExplainQueryPlan}
                disabled={running}
            >
                <Text style={localStyles.btnTxt}>Explain Query Plan (copy)</Text>
            </PressableWithFeedback>

            {Object.keys(allResults).length > 0 && !running && (
                <PressableWithFeedback
                    accessibilityRole="button"
                    accessibilityLabel="Copy results"
                    style={[localStyles.btn, {backgroundColor: '#28a745'}]}
                    onPress={copyResults}
                >
                    <Text style={localStyles.btnTxt}>Copy Results</Text>
                </PressableWithFeedback>
            )}

            <Text style={localStyles.status}>{status}</Text>

            {sizeResults.length > 0 && (
                <View style={localStyles.group}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6}}>
                        <Text style={localStyles.groupTitle}>Value sizes (200-key sample)</Text>
                        <PressableWithFeedback
                            accessibilityRole="button"
                            accessibilityLabel="Copy sizes"
                            style={{backgroundColor: '#28a745', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6}}
                            onPress={copySizeResults}
                        >
                            <Text style={{color: '#fff', fontSize: 11, fontWeight: '600'}}>Copy</Text>
                        </PressableWithFeedback>
                    </View>
                    <View style={localStyles.hRow}>
                        <Text style={[localStyles.cWide, localStyles.hTxt]}>Collection</Text>
                        <Text style={[localStyles.c, localStyles.hTxt]}>Keys</Text>
                        <Text style={[localStyles.c, localStyles.hTxt]}>Avg KB</Text>
                        <Text style={[localStyles.c, localStyles.hTxt]}>Key len</Text>
                    </View>
                    {sizeResults.map((r) => (
                        <View
                            key={r.prefix}
                            style={{marginBottom: 4}}
                        >
                            <View style={localStyles.row}>
                                <Text style={localStyles.cWide}>{r.prefix}</Text>
                                <Text style={localStyles.c}>{r.keyCount}</Text>
                                <Text style={localStyles.c}>{r.avgKB} KB</Text>
                                <Text style={localStyles.c}>{r.avgKeyLen} ch</Text>
                            </View>
                            <Text style={{fontSize: 9, color: '#888', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'}} numberOfLines={1}>
                                {r.sampleKey}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {measuredPrefixes.map((prefix) => {
                const baseResult = baselineMap.get(prefix);
                return (
                    <View
                        key={prefix}
                        style={localStyles.group}
                    >
                        <Text style={localStyles.groupTitle}>
                            {prefix} ({baseResult?.keyCount ?? '?'} keys)
                        </Text>
                        <View style={localStyles.hRow}>
                            <Text style={[localStyles.cWide, localStyles.hTxt]}>Strategy</Text>
                            <Text style={[localStyles.c, localStyles.hTxt]}>Median</Text>
                            <Text style={[localStyles.c, localStyles.hTxt]}>vs IN</Text>
                        </View>
                        {STRATEGIES.map((s) => {
                            const r = allResults[s.key]?.find((res) => res.prefix === prefix);
                            if (!r) {
                                return null;
                            }
                            const diff = baseResult && s.key !== 'in_clause' ? ((r.median - baseResult.median) / baseResult.median) * 100 : null;
                            const diffStr = diff == null ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
                            // eslint-disable-next-line no-nested-ternary
                            const clr = diff == null ? '#666' : diff < -5 ? '#2d8a4e' : diff > 5 ? '#d32f2f' : '#666';
                            return (
                                <View
                                    key={s.key}
                                    style={localStyles.row}
                                >
                                    <Text style={localStyles.cWide}>{s.label}</Text>
                                    <Text style={localStyles.c}>{r.median.toFixed(1)}ms</Text>
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

MultiGetBenchmark.displayName = 'MultiGetBenchmark';

export default MultiGetBenchmark;
