import type {OnyxEntry} from 'react-native-onyx';
import {getIsOffline} from '@libs/NetworkState';
import {openReport} from '@userActions/Report';
import type {Beta, IntroSelected} from '@src/types/onyx';

const seenThisSession = new Set<string>();

type PrefetchInputs = {
    reportID: string;
    introSelected: OnyxEntry<IntroSelected>;
    betas: OnyxEntry<Beta[]>;
};

/**
 * Records a report as already-known-to-this-session so future prefetch
 * attempts for it skip. Call this when the user lands on a report — its
 * page-level loader has fired `openReport` already, and we don't want the
 * neighbor prefetcher refiring it the moment that report becomes a neighbor
 * of where the user navigates next.
 */
function markReportSeen(reportID: string): void {
    seenThisSession.add(reportID);
}

/**
 * Fires `openReport` for a report we expect the user to navigate to soon, so
 * by the time they tap Next or Prev the full server payload (action history,
 * pagination state, parent/chat metadata) is already in Onyx.
 *
 * Each reportID is fetched at most once per session — combined with
 * `markReportSeen`, this covers both reports the user reached via the
 * prefetcher and reports they opened directly.
 */
function prefetchReport({reportID, introSelected, betas}: PrefetchInputs): void {
    if (getIsOffline()) {
        return;
    }
    if (seenThisSession.has(reportID)) {
        return;
    }
    seenThisSession.add(reportID);
    openReport({reportID, introSelected, betas});
}

export {markReportSeen, prefetchReport};
