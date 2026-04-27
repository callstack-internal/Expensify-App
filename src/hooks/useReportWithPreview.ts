import {useRoute} from '@react-navigation/native';
import type {OnyxEntry} from 'react-native-onyx';
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

    // Only apply route fallback when the route actually targets this reportID.
    // Prevents leaking unrelated screen params into reads for parent/chat/etc. reports.
    const routeMatchesReport = !!reportID && params?.reportID === reportID;
    if (!reportFromOnyx && !routeMatchesReport) {
        return undefined;
    }

    return {
        ...reportFromOnyx,
        reportID: reportFromOnyx?.reportID ?? reportID,
        parentReportID: reportFromOnyx?.parentReportID ?? (routeMatchesReport ? params?.parentReportID : undefined),
        parentReportActionID: reportFromOnyx?.parentReportActionID ?? (routeMatchesReport ? params?.parentReportActionID : undefined),
        chatReportID: reportFromOnyx?.chatReportID ?? (routeMatchesReport ? params?.chatReportID : undefined),
        policyID: reportFromOnyx?.policyID ?? (routeMatchesReport ? params?.policyID : undefined),
    } as Report;
}

export default useReportWithPreview;
