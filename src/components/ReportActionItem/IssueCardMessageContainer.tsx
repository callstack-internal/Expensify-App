import React from 'react';
import IssueCardMessage from '@components/ReportActionItem/IssueCardMessage';
import useOnyx from '@hooks/useOnyx';
import {isPolicyAdmin} from '@libs/PolicyUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportAction} from '@src/types/onyx';

type IssueCardMessageContainerProps = {
    action: ReportAction;
    policyID: string | undefined;
};

function IssueCardMessageContainer({action, policyID}: IssueCardMessageContainerProps) {
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`);
    return (
        <IssueCardMessage
            action={action}
            policyID={policyID}
            shouldNavigateToCardDetails={isPolicyAdmin(policy)}
        />
    );
}

export default IssueCardMessageContainer;
