/**
 * MultiGet Real Data Benchmark
 *
 * Measures multiGet performance on real OnyxDB data (not synthetic).
 * Use this to get before/after numbers when changing SQLiteProvider.multiGet.
 *
 * Workflow:
 *   1. Run "Measure current" → records baseline
 *   2. Change the multiGet implementation in SQLiteProvider
 *   3. Rebuild app
 *   4. Run "Measure current" again → compare to baseline
 *
 * Access via Test Tools Modal.
 */
import Clipboard from '@react-native-clipboard/clipboard';
import React, {useCallback, useState} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
// eslint-disable-next-line no-restricted-imports
import storage from 'react-native-onyx/dist/storage';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';

const RUNS = 40;
const LOOPS = 6;
const MIN_COLLECTION_SIZE = 200; // only benchmark collections with enough keys to be meaningful
const PAUSE_BETWEEN_COLLECTIONS_MS = 200;

const localStyles = StyleSheet.create({
    title: {fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 2},
    sub: {fontSize: 11, color: '#666', marginBottom: 12},
    btn: {backgroundColor: '#0366d6', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 8},
    btnOff: {backgroundColor: '#999'},
    btnTxt: {color: '#fff', fontWeight: '600', fontSize: 14},
    status: {fontSize: 11, color: '#666', marginBottom: 12, fontStyle: 'italic'},
    group: {marginBottom: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10},
    collectionTitle: {fontSize: 12, fontWeight: '600', marginBottom: 4},
    row: {flexDirection: 'row', paddingVertical: 2},
    c: {flex: 1, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'},
    cWide: {flex: 2, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'},
    hRow: {flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingBottom: 3, marginBottom: 4},
    hTxt: {fontWeight: '600', fontSize: 10},
});

type CollectionResult = {
    prefix: string;
    keyCount: number;
    median: number;
    min: number;
    max: number;
};

// eslint-disable-next-line no-promise-executor-return
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));


/** Extract collection prefix from a key like "reportActions_12345" → "reportActions_" */
function getPrefix(key: string): string {
    const match = key.match(/^([a-zA-Z]+_)/);
    return match ? match[1] : key;
}

async function measureCollection(keys: string[]): Promise<{median: number; min: number; max: number}> {
    // 3 warmup runs
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
        const loopMedian = times.at(Math.floor(times.length / 2)) ?? 0;
        loopMedians.push(loopMedian);
        overallMin = Math.min(overallMin, times.at(0) ?? 0);
        overallMax = Math.max(overallMax, times.at(-1) ?? 0);
        // eslint-disable-next-line no-await-in-loop
        await pause(100);
    }

    loopMedians.sort((a, b) => a - b);
    return {
        median: loopMedians.at(Math.floor(loopMedians.length / 2)) ?? 0,
        min: overallMin,
        max: overallMax,
    };
}

function MultiGetBenchmark() {
    const [results, setResults] = useState<CollectionResult[]>([]);
    const [baseline, setBaseline] = useState<CollectionResult[] | null>(null);
    const [running, setRunning] = useState(false);
    const [status, setStatus] = useState('Ready — loads real OnyxDB collections');

    const runMeasurement = useCallback(
        async (saveAsBaseline: boolean) => {
            if (Platform.OS === 'web') {
                setStatus('Only runs on iOS/Android');
                return;
            }
            setRunning(true);
            setResults([]);

            try {
                setStatus('Loading all keys from OnyxDB...');
                const allKeys = await storage.getAllKeys();

                // Group keys by collection prefix
                const prefixMap = new Map<string, string[]>();
                for (const key of allKeys) {
                    const prefix = getPrefix(key);
                    const existing = prefixMap.get(prefix) ?? [];
                    if (!prefixMap.has(prefix)) {
                        prefixMap.set(prefix, existing);
                    }
                    existing.push(key);
                }

                // Only measure collections large enough to matter
                const collections = Array.from(prefixMap.entries())
                    .filter(([, keys]) => keys.length >= MIN_COLLECTION_SIZE)
                    .sort(([, a], [, b]) => b.length - a.length); // largest first

                if (collections.length === 0) {
                    setStatus(`No collections with ${MIN_COLLECTION_SIZE}+ keys found. Try with a loaded account.`);
                    setRunning(false);
                    return;
                }

                setStatus(`Found ${collections.length} collections. Benchmarking...`);
                const collectionResults: CollectionResult[] = [];

                for (const [prefix, keys] of collections) {
                    setStatus(`Measuring ${prefix} (${keys.length} keys)...`);
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
                    // eslint-disable-next-line no-await-in-loop
                    await pause(PAUSE_BETWEEN_COLLECTIONS_MS);

                    // eslint-disable-next-line no-await-in-loop
                    const r = await measureCollection(keys);
                    collectionResults.push({prefix, keyCount: keys.length, ...r});
                    setResults([...collectionResults]);
                }

                if (saveAsBaseline) {
                    setBaseline(collectionResults);
                    setStatus(`Baseline saved! ${collections.length} collections measured.`);
                } else {
                    setStatus(`Done! ${collections.length} collections measured.`);
                }
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setStatus(`Error: ${msg}`);
                // eslint-disable-next-line no-console
                console.error('MultiGet benchmark error:', e);
            } finally {
                setRunning(false);
            }
        },
        [],
    );

    const copyResults = useCallback(() => {
        const output = JSON.stringify(
            {
                platform: Platform.OS,
                timestamp: new Date().toISOString(),
                config: {runs: RUNS, minCollectionSize: MIN_COLLECTION_SIZE},
                baseline: baseline ?? [],
                current: results,
            },
            null,
            2,
        );
        Clipboard.setString(output);
        setStatus('Copied to clipboard!');
    }, [baseline, results]);

    const baselineMap = new Map(baseline?.map((r) => [r.prefix, r]) ?? []);

    return (
        <View>
            <Text style={localStyles.title}>multiGet — Real Data Benchmark</Text>
            <Text style={localStyles.sub}>
                Measures Storage.multiGet on real OnyxDB collections.{'\n'}
                {LOOPS} loops x {RUNS} runs, median of medians. Collections with {MIN_COLLECTION_SIZE}+ keys only.
            </Text>

            <PressableWithFeedback
                accessibilityRole="button"
                accessibilityLabel="Save as baseline"
                style={[localStyles.btn, {backgroundColor: '#6f42c1'}, running && localStyles.btnOff]}
                onPress={() => runMeasurement(true)}
                disabled={running}
            >
                <Text style={localStyles.btnTxt}>{running ? 'Running...' : 'Save as Baseline'}</Text>
            </PressableWithFeedback>

            <PressableWithFeedback
                accessibilityRole="button"
                accessibilityLabel="Measure current"
                style={[localStyles.btn, running && localStyles.btnOff]}
                onPress={() => runMeasurement(false)}
                disabled={running}
            >
                <Text style={localStyles.btnTxt}>{running ? 'Running...' : 'Measure Current'}</Text>
            </PressableWithFeedback>

            {results.length > 0 && !running && (
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

            {results.length > 0 && (
                <View style={localStyles.group}>
                    <View style={localStyles.hRow}>
                        <Text style={[localStyles.cWide, localStyles.hTxt]}>Collection</Text>
                        <Text style={[localStyles.c, localStyles.hTxt]}>Keys</Text>
                        <Text style={[localStyles.c, localStyles.hTxt]}>Median</Text>
                        <Text style={[localStyles.c, localStyles.hTxt]}>vs baseline</Text>
                    </View>
                    {results.map((r) => {
                        const base = baselineMap.get(r.prefix);
                        const diff = base ? ((r.median - base.median) / base.median) * 100 : null;
                        const diffStr = diff == null ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
                        // eslint-disable-next-line no-nested-ternary
                        const clr = diff == null ? '#666' : diff < -5 ? '#2d8a4e' : diff > 5 ? '#d32f2f' : '#666';
                        return (
                            <View
                                key={r.prefix}
                                style={localStyles.row}
                            >
                                <Text style={localStyles.cWide}>{r.prefix}</Text>
                                <Text style={localStyles.c}>{r.keyCount}</Text>
                                <Text style={localStyles.c}>{r.median.toFixed(2)}ms</Text>
                                <Text style={[localStyles.c, {color: clr}]}>{diffStr}</Text>
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

MultiGetBenchmark.displayName = 'MultiGetBenchmark';

export default MultiGetBenchmark;
