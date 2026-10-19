// Local measurement only (expensify-issues#3041), not for commit.
globalThis.__ONYX_SELECTOR_STATS__ = true;
// Skip the Proxy dry run so memoized selectors are measured as they behave in prod.
globalThis.__ONYX_SELECTOR_STATS_ACCESS__ = false;
setInterval(() => {
    const s = globalThis.__onyxSelectorStats;
    if (!s) {
        return;
    }
    const t = s.totals();
    const w = s
        .dump()
        .filter((e) => e.key === 'snapshot_')
        .reduce(
            (acc, e) => ({
                selectorMs: acc.selectorMs + e.selectorMs,
                dataRecomputes: acc.dataRecomputes + e.dataRecomputes,
                identityReruns: acc.identityReruns + e.identityReruns,
                changed: acc.changed + e.changed,
            }),
            {selectorMs: 0, dataRecomputes: 0, identityReruns: 0, changed: 0},
        );
    // eslint-disable-next-line no-console
    console.log(
        `SELSTATS ${JSON.stringify({ts: Date.now(), allSelMs: t.selectorMs, eqMs: t.deepEqualMs, runs: t.dataRecomputes + t.identityReruns, wMs: w ? w.selectorMs : 0, wRuns: w ? w.dataRecomputes + w.identityReruns : 0, wChg: w ? w.changed : 0, xHits: t.crossInstanceHits, xMs: t.crossInstanceMs, xNameHits: t.crossInstanceByNameHits, xNameMs: t.crossInstanceByNameMs})}`,
    );
    // eslint-disable-next-line no-console
    console.log(
        `SELTOP ${JSON.stringify(
            s
                .dump()
                .slice(0, 6)
                .map((e) => [
                    e.selector.slice(0, 40),
                    e.key,
                    Math.round(e.selectorMs),
                    e.dataRecomputes + e.identityReruns,
                    e.wholeInput,
                    Math.round(e.deepEqualMs),
                    e.crossInstanceHits,
                    Math.round(e.crossInstanceMs),
                    e.crossInstanceByNameHits,
                    Math.round(e.crossInstanceByNameMs),
                ]),
        )}`,
    );
}, 3000);

// Measurement only: drop cached search snapshots at boot so every run fetches the same pages from page 1.
const Onyx = require('react-native-onyx').default;
setTimeout(() => {
    Onyx.setCollection('snapshot_', {}).then(() => {
        // eslint-disable-next-line no-console
        console.log('SELCLEAR cleared snapshots');
    });
}, 0);

// Measurement only: keep LogBox banners from catching swipes.
require('react-native').LogBox.ignoreAllLogs();

// Measurement only: compact cross-instance report, call __xdump('label') from devtools.
globalThis.__xdump = (label) => {
    const s = globalThis.__onyxSelectorStats;
    const t = s.totals();
    const d = s.dump();
    const r = (x) => Math.round(x * 10) / 10;
    const row = (e) =>
        `${e.selector.slice(0, 40)} @${e.key} | ms ${r(e.selectorMs)} runs ${e.dataRecomputes + e.identityReruns} | fn ${e.crossInstanceHits}/${r(e.crossInstanceMs)}ms | name ${e.crossInstanceByNameHits}/${r(e.crossInstanceByNameMs)}ms | sameOut ${e.crossInstanceByNameSameOutputHits}/${r(e.crossInstanceByNameSameOutputMs)}ms`;
    const wrapper = d.filter((e) => e.key === 'snapshot_');
    const rest = d.filter((e) => e.key !== 'snapshot_');
    const sum = (arr, k) => r(arr.reduce((a, e) => a + e[k], 0));
    const group = (arr) => ({
        selectorMs: sum(arr, 'selectorMs'),
        runs: arr.reduce((a, e) => a + e.dataRecomputes + e.identityReruns, 0),
        fnMs: sum(arr, 'crossInstanceMs'),
        nameMs: sum(arr, 'crossInstanceByNameMs'),
        sameOutMs: sum(arr, 'crossInstanceByNameSameOutputMs'),
    });
    const out = {
        label,
        totals: {selectors: t.selectors, deepEqualMs: t.deepEqualMs, ...group(d)},
        snapshotWrapper: group(wrapper),
        noWrapper: group(rest),
        topBySelectorMs: d.slice(0, 10).map(row),
        topBySameOutNoWrapper: [...rest]
            .sort((a, b) => b.crossInstanceByNameSameOutputMs - a.crossInstanceByNameSameOutputMs)
            .slice(0, 10)
            .map(row),
    };
    return out;
};
globalThis.__xsrc = (name, key) =>
    globalThis.__onyxSelectorStats
        .dump()
        .filter((e) => e.selector.startsWith(name) && (!key || e.key === key))
        .map((e) => `${e.selector.slice(0, 30)}@${e.key}: ${e.source}`);

// Measurement only: A/B toggle for the createOnyxSelector prototype. localStorage.sharedSelectors = '1' then reload.
try {
    globalThis.__ONYX_SHARED_SELECTORS__ = globalThis.localStorage?.getItem('sharedSelectors') === '1';
} catch {
    globalThis.__ONYX_SHARED_SELECTORS__ = false;
}
