import {deepEqual} from 'fast-equals';
import React, {useMemo, useRef} from 'react';
import {useCurrentReportIDState} from '@hooks/useCurrentReportID';
import useGetExpensifyCardFromReportAction from '@hooks/useGetExpensifyCardFromReportAction';
import useLazyDerivedValue from '@hooks/useLazyDerivedValue';
import useOnyx from '@hooks/useOnyx';
import usePrevious from '@hooks/usePrevious';
import {getMovedReportID} from '@libs/ModifiedExpenseMessage';
import {getOriginalMessage, isInviteOrRemovedAction, isMoneyRequestAction} from '@libs/ReportActionsUtils';
import SidebarUtils from '@libs/SidebarUtils';
import CONST from '@src/CONST';
import type {OptionData} from '@src/libs/ReportUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import OptionRowLHN from './OptionRowLHN';
import type {OptionRowLHNDataProps} from './types';

/*
 * This component gets the data from onyx for the actual
 * OptionRowLHN component.
 * The OptionRowLHN component is memoized, so it will only
 * re-render if the data really changed.
 */
function OptionRowLHNData({
    isOptionFocused = false,
    fullReport,
    reportAttributes,
    oneTransactionThreadReport,
    reportNameValuePairs,
    reportActions,
    personalDetails = {},
    preferredLocale = CONST.LOCALES.DEFAULT,
    policy,
    invoiceReceiverPolicy,
    receiptTransactions,
    parentReportAction,
    iouReportReportActions,
    transaction,
    transactionViolations,
    localeCompare,
    translate,
    isReportArchived = false,
    currentUserAccountID,
    ...propsToForward
}: OptionRowLHNDataProps) {
    const reportID = propsToForward.reportID;
    const {currentReportID: currentReportIDValue} = useCurrentReportIDState();
    const lazyLastMessageText = useLazyDerivedValue(ONYXKEYS.DERIVED.LAST_MESSAGE_TEXT, reportID);
    const lazyReportName = useLazyDerivedValue(ONYXKEYS.DERIVED.REPORT_NAME, reportID);
    const actionIDs = useLazyDerivedValue(ONYXKEYS.DERIVED.REPORT_LAST_ACTION_IDS, reportID);
    const isReportFocused = isOptionFocused && currentReportIDValue === reportID;
    const optionItemRef = useRef<OptionData | undefined>(undefined);

    // Derive lastAction and lastReportAction from the lazy derived action IDs
    const lastAction = actionIDs?.lastVisibleActionID ? reportActions?.[actionIDs.lastVisibleActionID] : undefined;
    const lastReportAction = actionIDs?.lastReportActionID ? reportActions?.[actionIDs.lastReportActionID] : undefined;

    // Compute lastReportActionTransaction locally
    const lastReportActionTransactionID = isMoneyRequestAction(lastReportAction)
        ? (getOriginalMessage(lastReportAction)?.IOUTransactionID ?? CONST.DEFAULT_NUMBER_ID)
        : CONST.DEFAULT_NUMBER_ID;
    const lastReportActionTransaction = receiptTransactions?.[`${ONYXKEYS.COLLECTION.TRANSACTION}${lastReportActionTransactionID}`];

    // Compute lastActionReport via useOnyx
    const lastActionReportID = isInviteOrRemovedAction(lastAction) ? (getOriginalMessage(lastAction) as {reportID?: string})?.reportID : undefined;
    const [lastActionReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${lastActionReportID}`, {canBeMissing: true});

    const [movedFromReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getMovedReportID(lastAction, CONST.REPORT.MOVE_TYPE.FROM)}`, {canBeMissing: true});
    const [movedToReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getMovedReportID(lastAction, CONST.REPORT.MOVE_TYPE.TO)}`, {canBeMissing: true});
    // Check the report errors equality to avoid re-rendering when there are no changes
    const prevReportErrors = usePrevious(reportAttributes?.reportErrors);
    const areReportErrorsEqual = useMemo(() => deepEqual(prevReportErrors, reportAttributes?.reportErrors), [prevReportErrors, reportAttributes?.reportErrors]);

    const card = useGetExpensifyCardFromReportAction({reportAction: lastAction, policyID: fullReport?.policyID});

    const optionItem = useMemo(() => {
        // Note: ideally we'd have this as a dependent selector in onyx!
        const item = SidebarUtils.getOptionData({
            report: fullReport,
            reportAttributes,
            oneTransactionThreadReport,
            reportNameValuePairs,
            personalDetails,
            policy,
            parentReportAction,
            lastMessageTextFromReport: lazyLastMessageText,
            invoiceReceiverPolicy,
            card,
            lastAction,
            translate,
            localeCompare,
            isReportArchived,
            lastActionReport,
            movedFromReport,
            movedToReport,
            currentUserAccountID,
        });
        if (deepEqual(item, optionItemRef.current)) {
            return optionItemRef.current;
        }

        optionItemRef.current = item;

        return item;
        // Listen parentReportAction to update title of thread report when parentReportAction changed
        // Listen to transaction to update title of transaction report when transaction changed
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        fullReport,
        reportAttributes?.brickRoadStatus,
        areReportErrorsEqual,
        oneTransactionThreadReport,
        reportNameValuePairs,
        lastReportActionTransaction,
        reportActions,
        personalDetails,
        preferredLocale,
        policy,
        parentReportAction,
        iouReportReportActions,
        transaction,
        receiptTransactions,
        invoiceReceiverPolicy,
        lazyLastMessageText,
        lazyReportName,
        card,
        translate,
        localeCompare,
        isReportArchived,
        movedFromReport,
        movedToReport,
        currentUserAccountID,
    ]);

    return (
        <OptionRowLHN
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...propsToForward}
            isOptionFocused={isReportFocused}
            optionItem={optionItem}
            report={fullReport}
        />
    );
}

OptionRowLHNData.displayName = 'OptionRowLHNData';

/**
 * This component is rendered in a list.
 * On scroll we want to avoid that a item re-renders
 * just because the list has to re-render when adding more items.
 * Thats also why the React.memo is used on the outer component here, as we just
 * use it to prevent re-renders from parent re-renders.
 */
export default React.memo(OptionRowLHNData);
