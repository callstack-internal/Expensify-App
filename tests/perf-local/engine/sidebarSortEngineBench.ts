/**
 * Engine-neutral version of SidebarUtilsSort.perf-local.ts: no Jest, no Reassure, so the same bundle runs on Node and Hermes.
 * Prints one Reassure-style JSON line per scenario ({name, meanDuration}), which scripts/perfGate.ts already reads.
 */
import SidebarUtils from '@libs/SidebarUtils';

import {
    buildSidebarSortDataset,
    getSidebarSortBenchmarkName,
    SIDEBAR_SORT_ACCENTED_SHARES,
    SIDEBAR_SORT_PRIORITY_MODES,
    SIDEBAR_SORT_REPORT_COUNTS,
    SIDEBAR_SORT_RUNS,
    SIDEBAR_SORT_WARMUP_RUNS,
} from '../utils/sidebarSortDataset';

declare const print: ((message: string) => void) | undefined;
declare const gc: (() => void) | undefined;

// Hermes CLI timers only tick in whole milliseconds, so short calls are timed in batches of at least this long.
const MIN_BATCH_MS = 20;
const MAX_BATCH_SIZE = 65536;

// Same options as localeCompare in tests/utils/TestHelper.ts, which can't be imported here because it pulls in Jest.
const collator = new Intl.Collator('en', {usage: 'sort', sensitivity: 'variant', numeric: true, caseFirst: 'upper'});
const localeCompare = (left: string, right: string) => collator.compare(left, right);

const now: () => number = typeof performance === 'object' && typeof performance.now === 'function' ? () => performance.now() : () => Date.now();
const log = typeof print === 'function' ? print : (message: string) => console.log(message);

function collectGarbage() {
    if (typeof gc !== 'function') {
        return;
    }
    gc();
}

/** Finds how many calls fill MIN_BATCH_MS, so every sample is long enough for a millisecond timer. */
function getBatchSize(fn: () => void): number {
    let batchSize = 1;
    for (;;) {
        const startedAt = now();
        for (let index = 0; index < batchSize; index++) {
            fn();
        }
        if (now() - startedAt >= MIN_BATCH_MS || batchSize >= MAX_BATCH_SIZE) {
            return batchSize;
        }
        batchSize *= 2;
    }
}

function measure(fn: () => void): number {
    const batchSize = getBatchSize(fn);
    const durations: number[] = [];
    for (let run = 0; run < SIDEBAR_SORT_RUNS + SIDEBAR_SORT_WARMUP_RUNS; run++) {
        collectGarbage();
        const startedAt = now();
        for (let index = 0; index < batchSize; index++) {
            fn();
        }
        if (run >= SIDEBAR_SORT_WARMUP_RUNS) {
            durations.push((now() - startedAt) / batchSize);
        }
    }
    return durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
}

for (const reportsCount of SIDEBAR_SORT_REPORT_COUNTS) {
    for (const accentedShare of SIDEBAR_SORT_ACCENTED_SHARES) {
        for (const {label, mode} of SIDEBAR_SORT_PRIORITY_MODES) {
            const {reportsToDisplay} = buildSidebarSortDataset(reportsCount, accentedShare);
            const meanDuration = measure(() => {
                SidebarUtils.sortReportsToDisplayInLHN(reportsToDisplay, mode, localeCompare, {}, {}, undefined);
            });
            log(JSON.stringify({name: getSidebarSortBenchmarkName(reportsCount, accentedShare, label), meanDuration}));
        }
    }
}

// App modules start timers at import time (Pusher, telemetry), which would keep Node alive after the last result.
if (typeof process === 'object' && typeof process.exit === 'function') {
    process.exit(0);
}
