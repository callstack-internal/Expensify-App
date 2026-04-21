import {useEffect} from 'react';
import useAppFocusEvent from '@hooks/useAppFocusEvent';
import useBankAccountUnlockEffect from '@hooks/useBankAccountUnlockEffect';
import {useCurrentReportIDState} from '@hooks/useCurrentReportID';
import useOnyx from '@hooks/useOnyx';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import clearReportNotifications from '@libs/Notification/clearReportNotifications';
import {cancelSpan, cancelSpansByPrefix} from '@libs/telemetry/activeSpans';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

type ReportLifecycleHandlerProps = {
    reportID: string | undefined;
};

/**
 * Component that does not render anything. Handles screen lifecycle side effects:
 * - Clear notifications when report is opened/re-focused
 * - Telemetry span cancellation on unmount
 * - Bank account unlock effect
 */
function ReportLifecycleHandler({reportID}: ReportLifecycleHandlerProps) {
    const onyxReportID = getNonEmptyStringOnyxID(reportID);
    const {currentReportID: currentReportIDValue} = useCurrentReportIDState();
    const isTopMostReportId = currentReportIDValue === reportID;

    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${onyxReportID}`);
    useBankAccountUnlockEffect(report);

    // Telemetry cleanup
    useEffect(() => {
        return () => {
            // Cancel telemetry span when user leaves the screen before full report data is loaded
            cancelSpan(`${CONST.TELEMETRY.SPAN_OPEN_REPORT}_${onyxReportID}`);

            // Cancel any pending send-message spans to prevent orphaned spans when navigating away
            cancelSpansByPrefix(CONST.TELEMETRY.SPAN_SEND_MESSAGE);
        };
    }, [onyxReportID]);

    // Clear notifications for the current report when it's opened and re-focused
    const clearNotifications = () => {
        // Check if this is the top-most ReportScreen since the Navigator preserves multiple at a time
        if (!isTopMostReportId) {
            return;
        }

        clearReportNotifications(onyxReportID);
    };

    useEffect(clearNotifications, [clearNotifications]);
    useAppFocusEvent(clearNotifications);

    return null;
}

ReportLifecycleHandler.displayName = 'ReportLifecycleHandler';

export default ReportLifecycleHandler;
