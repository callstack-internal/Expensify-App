import {useEffect} from 'react';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import Log from '@libs/Log';
import {cancelSpan, cancelSpansByPrefix} from '@libs/telemetry/activeSpans';
import CONST from '@src/CONST';

type TelemetrySpanProps = {
    /** Identity of the report whose telemetry span lifecycle this block owns. */
    reportID: string | undefined;

    /** Optional analytics tag describing where the user came from. Captured in a log line. */
    referrer?: string;
};

/**
 * Renderless block owning the report-fetch telemetry span lifecycle for one report.
 *
 * - On mount, logs the `referrer` so the navigation source can be correlated with the
 *   currently active span (the span itself is opened by the originating LHN / Search
 *   pressable; we never start spans here).
 * - On unmount, cancels any open `SPAN_OPEN_REPORT_<reportID>` and any in-flight
 *   `SPAN_SEND_MESSAGE_*` so the user navigating away does not leak orphaned spans.
 *
 * Today the same cancellation lives in `ReportLifecycleHandler`; once each compound
 * pulls its own lifecycle, the lifecycle handler shrinks accordingly.
 */
function TelemetrySpan({reportID, referrer}: TelemetrySpanProps) {
    const onyxReportID = getNonEmptyStringOnyxID(reportID);

    useEffect(() => {
        if (!onyxReportID) {
            return;
        }
        if (referrer) {
            Log.info('[TelemetrySpan] report opened with referrer', false, {reportID: onyxReportID, referrer});
        }
        return () => {
            // Cancel telemetry span when user leaves the screen before full report data is loaded
            cancelSpan(`${CONST.TELEMETRY.SPAN_OPEN_REPORT}_${onyxReportID}`);
            // Cancel any pending send-message spans to prevent orphaned spans when navigating away
            cancelSpansByPrefix(CONST.TELEMETRY.SPAN_SEND_MESSAGE);
        };
    }, [onyxReportID, referrer]);

    return null;
}

TelemetrySpan.displayName = 'TelemetrySpan';

export default TelemetrySpan;
