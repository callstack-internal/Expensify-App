import {useEffect, useRef} from 'react';
import useOnyx from '@hooks/useOnyx';
import {readNewestAction} from '@libs/actions/Report';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import ONYXKEYS from '@src/ONYXKEYS';

type InitHandlerProps = {
    /** Identity of the task report whose newest-action read this handler owns. */
    reportID: string | undefined;
};

/**
 * Renderless task-init block. Owns the single `readNewestAction` call task reports need
 * after their actions hydrate in Onyx. Today's `ReportFetchHandler` does the same, gated
 * on `isTaskReport(report)` and `!report.lastReadTime`. Once every kind has migrated to
 * its own compound, the lifecycle handler shrinks accordingly.
 *
 * Data-driven gating, not mount-order-driven:
 *   - We subscribe to the report (for `lastReadTime`) and to its actions collection
 *     (for "actions present?"). Both are scalar projections.
 *   - The fire is guarded by a per-`reportID` ref so re-renders never re-fire and
 *     navigating to a different task does not fire for the previous one.
 *   - The fire only happens after we observe report-actions populated in Onyx, matching
 *     the precondition `readNewestAction` already enforces internally.
 */
function InitHandler({reportID}: InitHandlerProps) {
    const onyxReportID = getNonEmptyStringOnyxID(reportID);
    const [lastReadTime] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${onyxReportID}`, {
        selector: (r) => r?.lastReadTime,
    });
    const [hasReportActions] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${onyxReportID}`, {
        selector: (actions) => !!actions && Object.keys(actions).length > 0,
    });

    const lastFiredForReportID = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (!onyxReportID) {
            return;
        }
        if (lastFiredForReportID.current === onyxReportID) {
            return;
        }
        // Mirror ReportFetchHandler's task-init guard: nothing to do if Onyx already
        // recorded a lastReadTime — the report was opened before.
        if (lastReadTime) {
            lastFiredForReportID.current = onyxReportID;
            return;
        }
        // Wait until report-actions are visible in Onyx before firing — this is the
        // same precondition `readNewestAction` enforces internally, lifted here so the
        // call itself is data-driven, not mount-order-driven.
        if (!hasReportActions) {
            return;
        }
        lastFiredForReportID.current = onyxReportID;
        readNewestAction(onyxReportID, true);
    }, [onyxReportID, lastReadTime, hasReportActions]);

    return null;
}

InitHandler.displayName = 'TaskReport.InitHandler';

export default InitHandler;
