async (page) => {
    // Path-skip prototype A/B: modes off/static/auto, three keys, CPU profile per round (4x CPU).
    const ROOM = '1540486774487195',
        W = 10,
        ROUNDS = 2;
    const results = {};
    for (const mode of ['off', 'static', 'auto']) {
        await page.goto(`https://dev.new.expensify.com:8083/r/${ROOM}`);
        await page.evaluate((mode) => {
            localStorage.setItem('onyxSelectorStats', '0');
            localStorage.setItem('onyxPathProto', mode);
        }, mode);
        await page.reload();
        await page.waitForTimeout(50000);
        const ids = await page.evaluate(async () => {
            const Onyx = window.Onyx;
            const get = (key) =>
                new Promise((res) => {
                    const c = Onyx.connect({
                        key,
                        callback: (v) => {
                            res(v);
                            setTimeout(() => Onyx.disconnect(c));
                        },
                    });
                });
            const session = await get('session');
            const room = await get('report_1540486774487195');
            const pd = await get('personalDetailsList');
            const actions = await get('reportActions_1540486774487195');
            const r = await get('report_');
            const others = Object.keys(room?.participants ?? {})
                .map(Number)
                .filter((id) => id !== session?.accountID && pd?.[id]);
            const actionIDs = Object.keys(actions ?? {}).sort((a, b) => ((actions[b]?.created ?? '') > (actions[a]?.created ?? '') ? 1 : -1));
            return {email: session?.email, reports: Object.keys(r ?? {}).length, participant: others[0], latestAction: actionIDs[0], mode: globalThis.__ONYX_PATH_PROTO__};
        });
        if (ids.email !== 'applausetester@applause.expensifail.com' || ids.mode !== mode) return {abort: ids, results};
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.setSamplingInterval', {interval: 250});
        const perKey = {};
        for (const kind of ['report', 'pd', 'ra']) {
            const rounds = [];
            for (let r = 0; r < ROUNDS; r++) {
                await page.waitForTimeout(1500);
                await page.evaluate(() => globalThis.__onyxSelectorStats.reset());
                await cdp.send('Profiler.start');
                await page.evaluate(
                    async ({kind, ids, W, ROOM}) => {
                        const Onyx = window.Onyx;
                        for (let i = 0; i < W; i++) {
                            if (kind === 'report') Onyx.merge(`report_${ROOM}`, {lastReadTime: new Date(Date.now() - 50000 + i).toISOString().replace('T', ' ').replace('Z', '')});
                            else if (kind === 'pd') Onyx.merge('personalDetailsList', {[ids.participant]: {perfTestCounter: i}});
                            else Onyx.merge(`reportActions_${ROOM}`, {[ids.latestAction]: {perfTestCounter: i}});
                            await new Promise((res) => setTimeout(res, 1000));
                        }
                    },
                    {kind, ids, W, ROOM},
                );
                const {profile} = await cdp.send('Profiler.stop');
                let busy = 0;
                const byId = new Map(profile.nodes.map((n) => [n.id, n]));
                for (let i = 0; i < profile.samples.length; i++) {
                    if (byId.get(profile.samples[i]).callFrame.functionName !== '(idle)') busy += profile.timeDeltas[i] || 0;
                }
                const st = await page.evaluate(() => {
                    const s = globalThis.__onyxSelectorStats;
                    const d = s.dumpDispatch();
                    const sum = s.dispatchSummary();
                    const t = d.reduce((a, x) => ({n: a.n + x.dispatches, l: a.l + x.listeners, ms: a.ms + x.ms}), {n: 0, l: 0, ms: 0});
                    return {dispatchMs: t.ms, listeners: t.l, proto: sum.proto};
                });
                rounds.push({
                    busyPerWrite: +(busy / 1000 / W).toFixed(1),
                    dispatchPerWrite: +(st.dispatchMs / W).toFixed(1),
                    listenersPerWrite: Math.round(st.listeners / W),
                    skippedPerWrite: Math.round(st.proto.skipped / W),
                    checkMsPerWrite: +(st.proto.checkMs / W).toFixed(2),
                    recordMsPerWrite: +(st.proto.recordMs / W).toFixed(2),
                });
            }
            perKey[kind] = rounds;
            await page.evaluate(
                async ({kind, ids, ROOM}) => {
                    const Onyx = window.Onyx;
                    if (kind === 'pd') await Onyx.merge('personalDetailsList', {[ids.participant]: {perfTestCounter: null}});
                    if (kind === 'ra') await Onyx.merge(`reportActions_${ROOM}`, {[ids.latestAction]: {perfTestCounter: null}});
                },
                {kind, ids, ROOM},
            );
        }
        await cdp.send('Emulation.setCPUThrottlingRate', {rate: 1});
        results[mode] = {reports: ids.reports, perKey};
    }
    await page.evaluate(() => localStorage.setItem('onyxPathProto', 'off'));
    return results;
};
