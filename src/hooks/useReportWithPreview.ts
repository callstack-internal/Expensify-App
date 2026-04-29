import {useRoute} from '@react-navigation/native';
import type {OnyxEntry} from 'react-native-onyx';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report} from '@src/types/onyx';
import useOnyx from './useOnyx';

type RoutePreviewParams = {
    reportID?: string;
    parentReportID?: string;
    parentReportActionID?: string;
    chatReportID?: string;
    policyID?: string;
};

/**
 * Read a report with route-param fallback for click-time identifiers when the
 * canonical Onyx entity hasn't hydrated yet. Onyx is authoritative once
 * populated; route params only fill the gap between press and the server's
 * `openReport` response.
 *
 * Press handlers pass `parentReportID` / `parentReportActionID` / `chatReportID`
 * / `policyID` as flat string params on `SEARCH_REPORT` (see `ROUTES.SEARCH_REPORT.getRoute`).
 * Those land in `route.params` and read here as fallbacks when the consumer
 * mounts before Onyx hydrates.
 *
 * Outside the SEARCH_REPORT mount path, route params don't carry these IDs, so
 * the hook behaves identically to a bare `useOnyx(report_${id})` read.
 *
 * Return shape matches `OnyxEntry<Report>` so consumers can swap from
 * `useOnyx(REPORT_${id})` to this hook in one line. Consumers already use
 * optional chaining throughout.
 */
function useReportWithPreview(reportID: string | undefined): OnyxEntry<Report> {
    const [reportFromOnyx] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const params = useRoute().params as RoutePreviewParams | undefined;

    if (reportFromOnyx) {
        return reportFromOnyx;
    }

    // Synthesize a preview stub only when the route carries actual preview context for this reportID.
    // Otherwise fall through to undefined so consumers (e.g. ReportNotFoundGuard) can detect genuinely missing reports.
    const routeMatchesReport = !!reportID && params?.reportID === reportID;
    const hasPreviewContext = routeMatchesReport && (!!params?.parentReportID || !!params?.parentReportActionID || !!params?.chatReportID || !!params?.policyID);

    if (!hasPreviewContext) {
        return undefined;
    }

    // `type: CHAT` lets `isChatThread` recognize the stub so `getReportName` can
    // synthesize the title from the parent IOU action (already in Onyx) — without
    // it, the header gates on an empty title and stays on the skeleton until
    // `openReport` resolves.
    return {
        reportID,
        type: CONST.REPORT.TYPE.CHAT,
        parentReportID: params?.parentReportID,
        parentReportActionID: params?.parentReportActionID,
        chatReportID: params?.chatReportID,
        policyID: params?.policyID,
    } as Report;
}

export default useReportWithPreview;
