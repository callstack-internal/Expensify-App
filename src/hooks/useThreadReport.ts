import {useRoute} from '@react-navigation/native';
import type {OnyxEntry} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import type CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report} from '@src/types/onyx';
import useOnyx from './useOnyx';

type ThreadContextFallback = {
    parentReportID?: string;
    parentReportActionID?: string;
    chatReportID?: string;
    policyID?: string;
    type?: ValueOf<typeof CONST.REPORT.TYPE>;
};

/**
 * Read a thread report with route-param fallback for context fields when the
 * Onyx entity hasn't hydrated yet. Onyx is authoritative once populated; route
 * params only fill the gap between press and the server's openReport response.
 *
 * Outside the RHP/SEARCH_REPORT mount path, route params carry no thread
 * context, so the hook behaves identically to a bare useOnyx read.
 *
 * Return shape matches `OnyxEntry<Report>` so consumers can swap from
 * `useOnyx(REPORT_${id})` to this hook with no other code changes. When Onyx
 * is empty but route fallback is present, the returned object only carries
 * the five fallback fields (other Report fields are undefined) — consumers
 * already use optional chaining throughout.
 */
function useThreadReport(reportID: string | undefined): OnyxEntry<Report> {
    const [reportFromOnyx] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const params = useRoute().params as {threadContext?: ThreadContextFallback} | undefined;
    const fallback = params?.threadContext;

    // Preserve useOnyx semantics: undefined when both sources are empty so consumers
    // doing `if (!report) ...` continue to early-exit correctly.
    if (!reportFromOnyx && !fallback) {
        return undefined;
    }

    return {
        ...reportFromOnyx,
        reportID: reportFromOnyx?.reportID ?? reportID,
        parentReportID: reportFromOnyx?.parentReportID ?? fallback?.parentReportID,
        parentReportActionID: reportFromOnyx?.parentReportActionID ?? fallback?.parentReportActionID,
        chatReportID: reportFromOnyx?.chatReportID ?? fallback?.chatReportID,
        policyID: reportFromOnyx?.policyID ?? fallback?.policyID,
        type: reportFromOnyx?.type ?? fallback?.type,
    } as Report;
}

export default useThreadReport;
