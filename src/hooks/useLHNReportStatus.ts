import {getParticipantsAccountIDsForDisplay, isOneOnOneChat} from '@libs/ReportUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Status, Timezone} from '@src/types/onyx/PersonalDetails';
import useOnyx from './useOnyx';

type LHNReportStatus = {
    status: Status | undefined;
    timezone: Timezone | undefined;
};

function useLHNReportStatus(reportID: string): LHNReportStatus {
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const [personalDetails] = useOnyx(ONYXKEYS.PERSONAL_DETAILS_LIST);

    if (!report || !personalDetails) {
        return {status: undefined, timezone: undefined};
    }

    const participantAccountIDs = getParticipantsAccountIDsForDisplay(report);
    const personalDetail = participantAccountIDs.length > 0 ? personalDetails[participantAccountIDs[0]] : undefined;

    const status = personalDetail?.status ?? undefined;
    const timezone = isOneOnOneChat(report) ? personalDetail?.timezone : undefined;

    return {status, timezone};
}

export default useLHNReportStatus;
