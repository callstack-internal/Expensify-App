import {useEffect, useRef} from 'react';
import useOnyx from '@hooks/useOnyx';
import {openReport} from '@libs/actions/Report';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import ONYXKEYS from '@src/ONYXKEYS';

type BootstrapFetcherProps = {
    /** Identity of the report to bootstrap. */
    reportID: string | undefined;
};

const isReportPopulated = (report: {reportID?: string} | undefined): boolean => !!report?.reportID;

/**
 * Renderless block. Owns the initial `OpenReport` call for a report shown by the new
 * compound architecture. Idempotent: if the report record is already populated in Onyx
 * at mount time, no fetch is fired. Otherwise, a single `openReport` is fired the first
 * time we see the report missing for this `reportID`. A change in `reportID` resets the
 * once-per-id guard.
 *
 * Multiple `openReport` calls on the same report are safe (the action is debounced and
 * all subsequent updates are merges), but firing only once per id reduces noise from
 * optimistic loading-state churn.
 */
function BootstrapFetcher({reportID}: BootstrapFetcherProps) {
    const onyxReportID = getNonEmptyStringOnyxID(reportID);
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${onyxReportID}`);
    const [introSelected] = useOnyx(ONYXKEYS.NVP_INTRO_SELECTED);
    const [betas] = useOnyx(ONYXKEYS.BETAS);

    // Tracks the reportID we last fired `openReport` for. Reset on id change.
    const lastFiredForReportID = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (!onyxReportID) {
            return;
        }
        if (lastFiredForReportID.current === onyxReportID) {
            return;
        }
        // Idempotency: if the report is already populated, skip the network call entirely.
        if (isReportPopulated(report)) {
            lastFiredForReportID.current = onyxReportID;
            return;
        }
        lastFiredForReportID.current = onyxReportID;
        openReport({reportID: onyxReportID, introSelected, betas});
    }, [onyxReportID, report, introSelected, betas]);

    return null;
}

BootstrapFetcher.displayName = 'BootstrapFetcher';

export default BootstrapFetcher;
