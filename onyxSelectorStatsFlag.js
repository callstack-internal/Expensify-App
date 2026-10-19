// Local measurement only (expensify-issues#3041), not for commit.
globalThis.__ONYX_SELECTOR_STATS__ = true;
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
        `SELSTATS ${JSON.stringify({ts: Date.now(), allSelMs: t.selectorMs, eqMs: t.deepEqualMs, runs: t.dataRecomputes + t.identityReruns, wMs: w ? w.selectorMs : 0, wRuns: w ? w.dataRecomputes + w.identityReruns : 0, wChg: w ? w.changed : 0})}`,
    );
    // eslint-disable-next-line no-console
    console.log(
        `SELTOP ${JSON.stringify(
            s
                .dump()
                .slice(0, 6)
                .map((e) => [e.selector.slice(0, 40), e.key, Math.round(e.selectorMs), e.dataRecomputes + e.identityReruns, e.wholeInput, Math.round(e.deepEqualMs)]),
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
