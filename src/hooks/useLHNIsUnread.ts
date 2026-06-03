import type {OnyxEntry} from 'react-native-onyx';
import {getOneTransactionThreadReportID} from '@libs/ReportActionsUtils';
import {isUnread} from '@libs/ReportUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportNameValuePairs} from '@src/types/onyx';
import useNetwork from './useNetwork';
import useOnyx from './useOnyx';

function privateIsArchivedSelector(reportNameValuePairs: OnyxEntry<ReportNameValuePairs>): string | undefined {
    return reportNameValuePairs?.private_isArchived;
}

function useLHNIsUnread(reportID: string): boolean {
    const {isOffline} = useNetwork();

    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const [chatReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${report?.chatReportID}`);
    const [reportActions] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`);
    const [privateIsArchived] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${reportID}`, {selector: privateIsArchivedSelector});

    const oneTransactionThreadReportID = getOneTransactionThreadReportID(report, chatReport, reportActions, isOffline);
    const [oneTransactionThreadReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${oneTransactionThreadReportID}`);

    return isUnread(report, oneTransactionThreadReport, !!privateIsArchived) && !!report?.lastActorAccountID;
}

export default useLHNIsUnread;
