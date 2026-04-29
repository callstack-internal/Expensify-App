import {useEffect} from 'react';
import {markReportSeen, prefetchReport} from '@libs/Search/ReportPrefetcher';
import ONYXKEYS from '@src/ONYXKEYS';
import useOnyx from './useOnyx';

/**
 * Forward-leaning window — Next is the dominant action, but the user can
 * also open a middle row directly and tap Prev, so warm one report behind too.
 */
const PREFETCH_FORWARD_COUNT = 2;
const PREFETCH_BACKWARD_COUNT = 1;

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
 * Prefetches data for the navigational neighbors (next 2, previous 1) of the
 * current report so tapping Next/Prev finds full openReport-shaped data
 * already in Onyx.
 *
 * Inputs are received from the caller, which already pays for `useSearchSections`,
 * so this hook does not trigger a second pass over the snapshot data.
 */
function useReportNeighborPrefetch({allReports, currentIndex}: Inputs): void {
    const [introSelected] = useOnyx(ONYXKEYS.NVP_INTRO_SELECTED);
    const [betas] = useOnyx(ONYXKEYS.BETAS);

    useEffect(() => {
        if (currentIndex === -1 || allReports.length === 0) {
            return;
        }

        // The page already loads the current report — mark it seen so a later
        // navigation that puts it at `-1` doesn't refire openReport for it.
        const currentReportID = allReports.at(currentIndex);
        if (currentReportID) {
            markReportSeen(currentReportID);
        }

        const timer = setTimeout(() => {
            const upcoming = allReports.slice(currentIndex + 1, currentIndex + 1 + PREFETCH_FORWARD_COUNT);
            const previous = allReports.slice(Math.max(0, currentIndex - PREFETCH_BACKWARD_COUNT), currentIndex);
            for (const reportID of [...upcoming, ...previous]) {
                if (!reportID) {
                    continue;
                }
                prefetchReport({reportID, introSelected, betas});
            }
        }, PREFETCH_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [currentIndex, allReports, introSelected, betas]);
}

export default useReportNeighborPrefetch;
