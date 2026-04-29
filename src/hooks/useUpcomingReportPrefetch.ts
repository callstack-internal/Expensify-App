import {useEffect} from 'react';
import prefetchReport from '@libs/Search/ReportPrefetcher';
import ONYXKEYS from '@src/ONYXKEYS';
import useOnyx from './useOnyx';

/**
 * Number of upcoming reports to warm. Forward-only — Next is the dominant
 * action, the snapshot hydrator already covers the first paint when the user
 * taps Prev, and prefetching `currentIndex - 1` would mostly hit reports the
 * user already loaded by getting to where they are now.
 */
const PREFETCH_FORWARD_COUNT = 2;

/**
 * Wait briefly so that rapid Next-Next-Next taps only enqueue one round of
 * prefetches (against the report the user actually settled on).
 */
const PREFETCH_DEBOUNCE_MS = 200;

type Inputs = {
    /** Ordered report IDs from the current search; usually `useSearchSections().allReports`. */
    allReports: ReadonlyArray<string | undefined>;
    /** Index of the report currently on screen within `allReports`. */
    currentIndex: number;
};

/**
 * Prefetches data for upcoming reports in the current search so tapping Next
 * finds full openReport-shaped data already in Onyx.
 *
 * Inputs are received from the caller, which already pays for `useSearchSections`,
 * so this hook does not trigger a second pass over the snapshot data.
 */
function useUpcomingReportPrefetch({allReports, currentIndex}: Inputs): void {
    const [introSelected] = useOnyx(ONYXKEYS.NVP_INTRO_SELECTED);
    const [betas] = useOnyx(ONYXKEYS.BETAS);

    useEffect(() => {
        if (currentIndex === -1 || allReports.length === 0) {
            return;
        }

        const timer = setTimeout(() => {
            const upcoming = allReports.slice(currentIndex + 1, currentIndex + 1 + PREFETCH_FORWARD_COUNT);
            for (const reportID of upcoming) {
                if (!reportID) {
                    continue;
                }
                prefetchReport({reportID, introSelected, betas});
            }
        }, PREFETCH_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [currentIndex, allReports, introSelected, betas]);
}

export default useUpcomingReportPrefetch;
