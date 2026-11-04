import SidebarUtils from '@libs/SidebarUtils';

import {measureFunction} from 'reassure';

import {localeCompare} from '../utils/TestHelper';
import {
    buildSidebarSortDataset,
    getSidebarSortBenchmarkName,
    SIDEBAR_SORT_ACCENTED_SHARES,
    SIDEBAR_SORT_PRIORITY_MODES,
    SIDEBAR_SORT_REPORT_COUNTS,
    SIDEBAR_SORT_RUNS,
    SIDEBAR_SORT_WARMUP_RUNS,
} from './utils/sidebarSortDataset';

describe('SidebarUtils sortReportsToDisplayInLHN', () => {
    for (const reportsCount of SIDEBAR_SORT_REPORT_COUNTS) {
        for (const accentedShare of SIDEBAR_SORT_ACCENTED_SHARES) {
            for (const {label, mode} of SIDEBAR_SORT_PRIORITY_MODES) {
                test(getSidebarSortBenchmarkName(reportsCount, accentedShare, label), async () => {
                    const {reportsToDisplay} = buildSidebarSortDataset(reportsCount, accentedShare);

                    await measureFunction(() => SidebarUtils.sortReportsToDisplayInLHN(reportsToDisplay, mode, localeCompare, {}, {}, undefined), {
                        runs: SIDEBAR_SORT_RUNS,
                        warmupRuns: SIDEBAR_SORT_WARMUP_RUNS,
                        // Collect garbage outside the timed call, so a GC pause left over from the previous run doesn't land in this one.
                        beforeEach: () => global.gc?.(),
                    });
                });
            }
        }
    }
});
