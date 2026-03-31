import React from 'react';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import {usePersonalDetails} from '@components/OnyxListItemProvider';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useOnyx from '@hooks/useOnyx';
import {canShowReportRecipientLocalTime, getReportRecipientAccountIDs} from '@libs/ReportUtils';
import ParticipantLocalTime from '@pages/inbox/report/ParticipantLocalTime';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxCommon from '@src/types/onyx/OnyxCommon';
import {useComposerState} from './ComposerContext';

type ComposerLocalTimeProps = {
    reportID: string;
    pendingAction?: OnyxCommon.PendingAction;
};

function ComposerLocalTimeInner({reportID, pendingAction}: ComposerLocalTimeProps) {
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const personalDetails = usePersonalDetails();
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);

    const reportRecipientAccountIDs = getReportRecipientAccountIDs(report, currentUserPersonalDetails.accountID);
    const reportRecipient = personalDetails?.[reportRecipientAccountIDs[0]];

    if (!reportRecipient) {
        return null;
    }

    if (!canShowReportRecipientLocalTime(personalDetails, report, currentUserPersonalDetails.accountID)) {
        return null;
    }

    return (
        <OfflineWithFeedback pendingAction={pendingAction}>
            <ParticipantLocalTime participant={reportRecipient} />
        </OfflineWithFeedback>
    );
}

function ComposerLocalTime({reportID, pendingAction}: ComposerLocalTimeProps) {
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`, {selector: (r) => ({participantCount: Object.keys(r?.participants ?? {}).length, isChatRoom: !!r?.chatType})});
    const {isComposerFullSize} = useComposerState();

    if (isComposerFullSize) {
        return null;
    }

    if (report?.participantCount !== 2 || report?.isChatRoom) {
        return null;
    }

    return (
        <ComposerLocalTimeInner
            reportID={reportID}
            pendingAction={pendingAction}
        />
    );
}

export default ComposerLocalTime;
