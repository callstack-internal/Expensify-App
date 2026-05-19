// TODO(slice-07): replace direct `transaction.pendingFields?.amount` reads with
// a `useReceiptPendingAction()` hook populated by ReceiptCard so the outer
// receipt-level pending action overrides per-field pending, matching the
// monolith's `getPendingFieldAction` shape.
import {Str} from 'expensify-common';
import React from 'react';
import type {ValueOf} from 'type-fest';
import {useSearchStateContext} from '@components/Search/SearchContext';
import useActiveRoute from '@hooks/useActiveRoute';
import {useCurrencyListActions} from '@hooks/useCurrencyList';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useHasMultipleSplitChildren from '@hooks/useHasMultipleSplitChildren';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useReportTransactions from '@hooks/useReportTransactions';
import initSplitExpense from '@libs/actions/SplitExpenses';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {isSingleTransactionReport} from '@libs/MoneyRequestReportUtils';
import Navigation from '@libs/Navigation/Navigation';
import {isSplitAction} from '@libs/ReportSecondaryActionUtils';
import {getTransactionDetails, isExpenseReport, isOpenReport, isReportApproved, isSettled as isSettledReportUtils} from '@libs/ReportUtils';
import {
    getOriginalAmountForDisplay,
    getOriginalTransactionWithSplitInfo,
    isFromCreditCardImport as isCardTransactionTransactionUtils,
    isGPSDistanceRequest as isGPSDistanceRequestTransactionUtils,
    isScanning,
} from '@libs/TransactionUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Transaction} from '@src/types/onyx';
import {useLiveTransactionField} from '../contexts/LiveTransactionProvider';
import {useSnapshotTransactionField} from '../contexts/SnapshotTransactionProvider';
import {useFieldEditPermission, useParentReportID, useTransactionThreadReport} from '../contexts/ThreadProvider';
import {useTransactionPolicyID} from '../contexts/TransactionPolicyContext';
import {useFieldViolationMessages} from '../contexts/ViolationsProvider';
import FieldRow from '../FieldRow';

function AmountRow() {
    const {translate} = useLocalize();
    const {convertToDisplayString} = useCurrencyListActions();
    const {getReportRHPActiveRoute} = useActiveRoute();
    const icons = useMemoizedLazyExpensifyIcons(['Checkmark']);
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const {currentSearchResults} = useSearchStateContext();

    const transaction = useLiveTransactionField((tx: Transaction) => tx);
    const canEditAmountBase = useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.AMOUNT);
    const transactionThreadReport = useTransactionThreadReport();
    const parentReportID = useParentReportID();
    const policyID = useTransactionPolicyID();
    const violationMessages = useFieldViolationMessages('amount');

    let [parentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${parentReportID}`);
    parentReport = parentReport ?? currentSearchResults?.data[`${ONYXKEYS.COLLECTION.REPORT}${parentReportID}`];
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`);
    const [originalTransaction] = useOnyx(`${ONYXKEYS.COLLECTION.TRANSACTION}${getNonEmptyStringOnyxID(transaction?.comment?.originalTransactionID)}`);
    const parentReportTransactions = useReportTransactions(parentReport?.reportID);
    const hasMultipleSplits = useHasMultipleSplitChildren(transaction?.comment?.originalTransactionID);

    const moneyRequestReport = parentReport;
    const isApproved = isReportApproved({report: moneyRequestReport});
    const isSettled = isSettledReportUtils(moneyRequestReport);
    const isCancelled = moneyRequestReport?.isCancelledIOU;
    const isReportOpen = isOpenReport(moneyRequestReport);
    const isFromCardImport = isCardTransactionTransactionUtils(transaction);
    const isGPSDistanceRequest = isGPSDistanceRequestTransactionUtils(transaction);
    const isTransactionScanning = isScanning(transaction);

    const details = getTransactionDetails(transaction, undefined, undefined, false, false, currentUserPersonalDetails);
    const transactionAmount = details?.amount;
    const transactionCurrency = details?.currency;
    const transactionOriginalCurrency = details?.originalCurrency;
    const transactionConvertedAmount = details?.convertedAmount;
    const transactionReimbursable = details?.reimbursable;

    const formattedTransactionAmount = convertToDisplayString(transactionAmount, transactionCurrency);
    const transactionOriginalAmount = transaction && getOriginalAmountForDisplay(transaction, isExpenseReport(moneyRequestReport));
    const formattedOriginalAmount = transactionOriginalAmount && transactionOriginalCurrency && convertToDisplayString(transactionOriginalAmount, transactionOriginalCurrency);

    const pendingAmount = transaction?.pendingFields?.amount;
    const shouldShowPaid = isSettled && transactionReimbursable && !transaction?.pendingAction;

    const {isExpenseSplit} = getOriginalTransactionWithSplitInfo(transaction, originalTransaction);
    const shouldShowSplitIndicator = isExpenseSplit && (hasMultipleSplits || isReportOpen);
    const isSplitAvailable =
        !!moneyRequestReport &&
        !!transaction &&
        isSplitAction(moneyRequestReport, [transaction], originalTransaction, currentUserPersonalDetails.login ?? '', currentUserPersonalDetails.accountID, policy);

    const canEditAmount = !isGPSDistanceRequest && (canEditAmountBase || (shouldShowSplitIndicator && !!isSplitAvailable));

    const currency = transactionCurrency ?? CONST.CURRENCY.USD;
    const shouldShowConvertedAmount =
        !!transactionConvertedAmount &&
        currency !== moneyRequestReport?.currency &&
        !isFromCardImport &&
        transaction?.reportID !== CONST.REPORT.UNREPORTED_REPORT_ID &&
        !pendingAmount &&
        !transaction?.pendingAction;

    let amountTitle = formattedTransactionAmount?.toString() || '';
    if (isTransactionScanning) {
        amountTitle = translate('iou.receiptStatusTitle');
    }

    let amountDescription = `${translate('iou.amount')}`;
    if (isFromCardImport) {
        if (formattedOriginalAmount) {
            amountDescription += ` ${CONST.DOT_SEPARATOR} ${translate('iou.original')} ${formattedOriginalAmount}`;
        }
        if (isCancelled) {
            amountDescription += ` ${CONST.DOT_SEPARATOR} ${translate('iou.canceled')}`;
        }
    } else if (isCancelled) {
        amountDescription += ` ${CONST.DOT_SEPARATOR} ${translate('iou.canceled')}`;
    } else if (isApproved) {
        amountDescription += ` ${CONST.DOT_SEPARATOR} ${translate('iou.approved')}`;
    } else if (shouldShowPaid) {
        amountDescription += ` ${CONST.DOT_SEPARATOR} ${translate('iou.settledExpensify')}`;
    }
    if (shouldShowSplitIndicator) {
        amountDescription += ` ${CONST.DOT_SEPARATOR} ${translate('iou.split')}`;
    }
    if (shouldShowConvertedAmount) {
        amountDescription += ` ${CONST.DOT_SEPARATOR} ${translate('common.converted')} ${convertToDisplayString(transactionConvertedAmount, moneyRequestReport?.currency)}`;
    }
    const isCurrentTransactionReimbursable = !!transactionReimbursable;
    if (!isCurrentTransactionReimbursable && isSingleTransactionReport(moneyRequestReport, parentReportTransactions)) {
        amountDescription += ` ${CONST.DOT_SEPARATOR} ${Str.UCFirst(translate('iou.nonReimbursable'))}`;
    }

    const violationsError = violationMessages.length > 0 ? `${violationMessages.map((v) => v.name).join('. ')}.` : '';
    const brickRoadIndicator = violationsError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined;
    const errorText = violationsError;

    const amountCopyValue = !canEditAmount ? amountTitle : undefined;
    const pendingActionForRow = pendingAmount ?? (amountTitle ? transaction?.pendingFields?.customUnitRateID : undefined);

    function onPress() {
        if (!transaction?.transactionID || !transactionThreadReport?.reportID) {
            return;
        }
        if (shouldShowSplitIndicator && isSplitAvailable) {
            initSplitExpense(transaction, policy);
            return;
        }
        let iouType: ValueOf<typeof CONST.IOU.TYPE> = CONST.IOU.TYPE.SUBMIT;
        if (moneyRequestReport && 'invoiceReceiver' in moneyRequestReport && moneyRequestReport.invoiceReceiver) {
            iouType = CONST.IOU.TYPE.INVOICE;
        }
        Navigation.navigate(
            ROUTES.MONEY_REQUEST_STEP_AMOUNT.getRoute(CONST.IOU.ACTION.EDIT, iouType, transaction.transactionID, transactionThreadReport.reportID, '', '', getReportRHPActiveRoute()),
        );
    }

    return (
        <FieldRow
            pendingAction={pendingActionForRow}
            title={amountTitle}
            shouldShowTitleIcon={shouldShowPaid}
            titleIcon={icons.Checkmark}
            description={amountDescription}
            interactive={canEditAmount}
            shouldShowRightIcon={canEditAmount}
            onPress={onPress}
            brickRoadIndicator={brickRoadIndicator}
            errorText={errorText}
            copyValue={amountCopyValue}
            copyable={!!amountCopyValue}
            numberOfLinesTitle={2}
        />
    );
}

function AmountRowSnapshot() {
    const {translate} = useLocalize();
    const {convertToDisplayString} = useCurrencyListActions();
    const amount = useSnapshotTransactionField((tx: Transaction) => tx.amount);
    const currency = useSnapshotTransactionField((tx: Transaction) => tx.currency);
    const title = convertToDisplayString(amount, currency)?.toString() ?? '';
    const description = `${translate('iou.amount')}`;

    return (
        <FieldRow
            title={title}
            description={description}
            interactive={false}
            shouldShowRightIcon={false}
            numberOfLinesTitle={2}
        />
    );
}

export {AmountRow, AmountRowSnapshot};
