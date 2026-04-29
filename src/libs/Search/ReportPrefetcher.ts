import type {OnyxEntry} from 'react-native-onyx';
import {openReport} from '@userActions/Report';
import type {Beta, IntroSelected} from '@src/types/onyx';

const prefetchedThisSession = new Set<string>();

type PrefetchInputs = {
    reportID: string;
    introSelected: OnyxEntry<IntroSelected>;
    betas: OnyxEntry<Beta[]>;
};

/**
 * Fires `openReport` for a report we expect the user to navigate to soon, so
 * by the time they tap Next the full server payload (action history,
 * pagination state, parent/chat metadata) is already in Onyx.
 *
 * Each reportID is prefetched at most once per session. Reports loaded via
 * other flows (e.g., opened directly from the inbox) are not tracked here, so
 * a redundant prefetch may fire if such a report later becomes a search
 * neighbor — the server returns the same data, no correctness issue.
 */
function prefetchReport({reportID, introSelected, betas}: PrefetchInputs): void {
    if (prefetchedThisSession.has(reportID)) {
        return;
    }
    prefetchedThisSession.add(reportID);
    openReport({reportID, introSelected, betas});
}

export default prefetchReport;
