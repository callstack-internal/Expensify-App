// Local measurement only (expensify-issues#3042), not for commit.
// Default: dispatch timing only (low overhead). Set localStorage.onyxSelectorStats = '1' for the full Proxy-based selector stats.
let full = false;
try {
    full = globalThis.localStorage?.getItem('onyxSelectorStats') === '1';
} catch {
    // ignore
}
globalThis.__ONYX_DISPATCH_TIMING__ = true;
globalThis.__ONYX_SELECTOR_STATS__ = full;
// Path-skip prototype mode: 'off' | 'static' | 'auto' (expensify-issues#3042).
try {
    globalThis.__ONYX_PATH_PROTO__ = globalThis.localStorage?.getItem('onyxPathProto') ?? 'off';
} catch {
    globalThis.__ONYX_PATH_PROTO__ = 'off';
}

// Native-only path-skip prototype benchmark on Hermes (expensify-issues#3042). Logs "BENCH3042 ..." with console.warn
// (production builds strip console.log). Waits for the heavy test account, then runs off/static/auto for three keys.
const {Platform} = require('react-native');
if (Platform.OS !== 'web') {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const ROOM = '1540486774487195';
    const get = (Onyx, key) =>
        new Promise((res) => {
            const c = Onyx.connect({
                key,
                callback: (v) => {
                    res(v);
                    setTimeout(() => Onyx.disconnect(c));
                },
            });
        });
    const runKind = async (Onyx, kind, ids) => {
        let blocked = 0;
        let last = Date.now();
        const tick = setInterval(() => {
            const now = Date.now();
            const lag = now - last - 10;
            if (lag > 0) {
                blocked += lag;
            }
            last = now;
        }, 10);
        globalThis.__onyxSelectorStats?.reset();
        const W = 10;
        for (let i = 0; i < W; i++) {
            if (kind === 'report') {
                Onyx.merge(`report_${ROOM}`, {lastReadTime: new Date(Date.now() - 90000 + i).toISOString().replace('T', ' ').replace('Z', '')});
            } else if (kind === 'pd') {
                Onyx.merge('personalDetailsList', {[ids.participant]: {perfTestCounter: i}});
            } else {
                Onyx.merge(`reportActions_${ROOM}`, {[ids.latestAction]: {perfTestCounter: i}});
            }
            await sleep(1000);
        }
        clearInterval(tick);
        const s = globalThis.__onyxSelectorStats;
        const d = s.dumpDispatch().reduce((a, x) => ({n: a.n + x.dispatches, l: a.l + x.listeners, ms: a.ms + x.ms}), {n: 0, l: 0, ms: 0});
        const p = s.dispatchSummary().proto;
        const r1 = (v) => Math.round(v * 10) / 10;
        return {
            blocked: Math.round(blocked / W),
            dispatch: r1(d.ms / W),
            listeners: Math.round(d.l / W),
            skipped: Math.round(p.skipped / W),
            check: r1(p.checkMs / W),
            record: r1(p.recordMs / W),
        };
    };
    const start = async () => {
        const Onyx = require('react-native-onyx').default;
        // Wait until the heavy test account is signed in and loaded.
        for (;;) {
            const session = await get(Onyx, 'session');
            const reports = await get(Onyx, 'report_');
            const n = Object.keys(reports ?? {}).length;
            if (session?.email === 'applausetester@applause.expensifail.com' && n > 3000) {
                break;
            }
            await sleep(5000);
        }
        await sleep(30000);
        const session = await get(Onyx, 'session');
        const room = await get(Onyx, `report_${ROOM}`);
        const pd = await get(Onyx, 'personalDetailsList');
        const actions = await get(Onyx, `reportActions_${ROOM}`);
        const reports = await get(Onyx, 'report_');
        // Prefer someone in the room; fall back to any other person in personal details.
        const participant =
            Object.keys(room?.participants ?? {})
                .map(Number)
                .find((id) => id !== session?.accountID && pd?.[id]) ??
            Object.keys(pd ?? {})
                .map(Number)
                .find((id) => id !== session?.accountID);
        const latestAction = Object.keys(actions ?? {}).sort((a, b) => ((actions[b]?.created ?? '') > (actions[a]?.created ?? '') ? 1 : -1))[0];
        const ids = {participant, latestAction};
        console.warn(
            `BENCH3042 start ${JSON.stringify({email: session?.email, reports: Object.keys(reports ?? {}).length, people: Object.keys(pd ?? {}).length, roomParticipants: Object.keys(room?.participants ?? {}).length, ...ids, dev: __DEV__})}`,
        );
        if (!participant || !latestAction) {
            console.warn('BENCH3042 abort missing ids');
            return;
        }
        const results = {};
        for (const mode of ['off', 'static', 'auto', 'off2']) {
            globalThis.__ONYX_PATH_PROTO__ = mode === 'off2' ? 'off' : mode;
            results[mode] = {};
            for (const kind of ['report', 'pd', 'ra']) {
                // One warm-up write so every selector records its paths in this mode.
                if (kind === 'report') {
                    Onyx.merge(`report_${ROOM}`, {lastReadTime: new Date(Date.now() - 95000).toISOString().replace('T', ' ').replace('Z', '')});
                } else if (kind === 'pd') {
                    Onyx.merge('personalDetailsList', {[participant]: {perfTestCounter: -1}});
                } else {
                    Onyx.merge(`reportActions_${ROOM}`, {[latestAction]: {perfTestCounter: -1}});
                }
                await sleep(2000);
                results[mode][kind] = await runKind(Onyx, kind, ids);
            }
            console.warn(`BENCH3042 mode ${mode} ${JSON.stringify(results[mode])}`);
        }
        globalThis.__ONYX_PATH_PROTO__ = 'off';
        await Onyx.merge('personalDetailsList', {[participant]: {perfTestCounter: null}});
        await Onyx.merge(`reportActions_${ROOM}`, {[latestAction]: {perfTestCounter: null}});
        console.warn(`BENCH3042 result ${JSON.stringify(results)}`);
    };
    setTimeout(start, 20000);
}
