import stableReportSelector from '@selectors/stableReportSelector';
import React, {useCallback} from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import useOnyx from '@hooks/useOnyx';
import useOriginalReportID from '@hooks/useOriginalReportID';
import useReportIsArchived from '@hooks/useReportIsArchived';
import useReportTransactions from '@hooks/useReportTransactions';
import {getIOUReportIDFromReportActionPreview, getOriginalMessage, isMoneyRequestAction} from '@libs/ReportActionsUtils';
import {isArchivedNonExpenseReport, isClosedExpenseReportWithNoExpenses} from '@libs/ReportUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import type {PersonalDetailsList, Transaction} from '@src/types/onyx';
import type {PureReportActionItemProps} from './PureReportActionItem';
import PureReportActionItem from './PureReportActionItem';

type ReportActionItemProps = PureReportActionItemProps & {
    /** Whether to show the draft message or not */
    shouldShowDraftMessage?: boolean;

    /** Personal details list */
    personalDetails: OnyxEntry<PersonalDetailsList>;

    /** The original report ID for draft message lookups */
    originalReportID?: string;
};

function ReportActionItem({action, report, originalReportID, personalDetails, linkedTransactionRouteError: linkedTransactionRouteErrorProp, ...props}: ReportActionItemProps) {
    const isOriginalReportArchived = useReportIsArchived(originalReportID);
    const [originalReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${originalReportID}`, {selector: stableReportSelector});
    const [iouReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getIOUReportIDFromReportActionPreview(action)}`);

    const transactionsOnIOUReport = useReportTransactions(iouReport?.reportID);
    const transactionID = isMoneyRequestAction(action) && getOriginalMessage(action)?.IOUTransactionID;

    const getLinkedTransactionRouteError = useCallback(
        (transaction: OnyxEntry<Transaction>) => {
            return linkedTransactionRouteErrorProp ?? transaction?.errorFields?.route;
        },
        [linkedTransactionRouteErrorProp],
    );

    const [linkedTransactionRouteError] = useOnyx(`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`, {selector: getLinkedTransactionRouteError});

    return (
        <PureReportActionItem
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...props}
            action={action}
            report={report}
            iouReport={iouReport}
            linkedTransactionRouteError={linkedTransactionRouteError}
            personalDetails={personalDetails}
            originalReportID={originalReportID}
            originalReport={originalReport}
            isArchivedRoom={isArchivedNonExpenseReport(originalReport, isOriginalReportArchived)}
            isClosedExpenseReportWithNoExpenses={isClosedExpenseReportWithNoExpenses(iouReport, transactionsOnIOUReport)}
        />
    );
}

export default ReportActionItem;
