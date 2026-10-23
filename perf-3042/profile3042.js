async (page) => {
    // CPU-profile A/B: W field-only merges on the open report, each followed by 1s so debounced work lands in the window.
    const W = 10,
        ROUNDS = 3;
    // Use the chat currently open in the tab, so any account works
    const m = page.url().match(/\/r\/(\d+)/);
    if (!m) return 'open a chat first';
    const KEY = `report_${m[1]}`;
    await page.goto(`https://dev.new.expensify.com:8083/r/${m[1]}`);
    await page.evaluate(() => localStorage.setItem('onyxSelectorStats', '0'));
    await page.reload();
    await page.waitForTimeout(45000);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', {interval: 250});
    const buckets = [
        ['unreadMemo', /^getUnreadReportsForUnreadIndicator$|^getKeyIndex$/],
        ['lhnContext', /^SidebarOrderedReportsContextProvider$/],
        ['derived', /^flushRecompute$/],
        ['onyxDispatch', /^notifyKey$|^notifyCollection$/],
        ['reactRender', /^performWorkOnRoot$/],
    ];
    const out = [];
    for (let r = 0; r < ROUNDS; r++) {
        await page.waitForTimeout(2000);
        await cdp.send('Profiler.start');
        await page.evaluate(
            async ({W, KEY}) => {
                const Onyx = window.Onyx;
                for (let i = 0; i < W; i++) {
                    Onyx.merge(KEY, {lastReadTime: new Date(Date.now() - 20000 + i).toISOString().replace('T', ' ').replace('Z', '')});
                    await new Promise((res) => setTimeout(res, 1000));
                }
            },
            {W, KEY},
        );
        const {profile} = await cdp.send('Profiler.stop');
        const byId = new Map(profile.nodes.map((n) => [n.id, n]));
        const parent = new Map();
        for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
        let busy = 0;
        const b = Object.fromEntries(buckets.map(([k]) => [k, 0]));
        for (let i = 0; i < profile.samples.length; i++) {
            const leaf = byId.get(profile.samples[i]);
            const d = profile.timeDeltas[i] || 0;
            if (leaf.callFrame.functionName === '(idle)') continue;
            busy += d;
            const names = new Set();
            let id = profile.samples[i];
            while (id) {
                names.add(byId.get(id).callFrame.functionName);
                id = parent.get(id);
            }
            for (const [k, re] of buckets) {
                for (const nm of names) {
                    if (re.test(nm)) {
                        b[k] += d;
                        break;
                    }
                }
            }
        }
        const per = (v) => +(v / 1000 / W).toFixed(1);
        out.push({busyPerWrite: per(busy), ...Object.fromEntries(Object.entries(b).map(([k, v]) => [k, per(v)]))});
    }
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: 1});
    const meta = await page.evaluate(async (KEY) => {
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
        const r = await get('report_');
        const s = await get('session');
        return {email: s?.email, reports: Object.keys(r ?? {}).length, key: KEY};
    }, KEY);
    return {meta, out};
};
