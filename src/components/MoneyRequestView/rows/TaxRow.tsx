import React from 'react';
import useActiveRoute from '@hooks/useActiveRoute';
import {useCurrencyListActions} from '@hooks/useCurrencyList';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import {isTaxTrackingEnabled} from '@libs/PolicyUtils';
import {isReportInGroupPolicy} from '@libs/ReportUtils';
import {
    getTaxName,
    isDistanceRequest as isDistanceRequestTransactionUtils,
    isExpenseUnreported as isExpenseUnreportedTransactionUtils,
    isPerDiemRequest as isPerDiemRequestTransactionUtils,
    isTimeRequest as isTimeRequestTransactionUtils,
} from '@libs/TransactionUtils';
import Navigation from '@navigation/Navigation';
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

function TaxRow() {
    const {translate} = useLocalize();
    const {convertToDisplayString} = useCurrencyListActions();
    const {getReportRHPActiveRoute} = useActiveRoute();

    const transaction = useLiveTransactionField((tx: Transaction) => tx);
    const canEditTaxRate = useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.TAX_RATE);
    const canEditTaxAmount = useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.TAX_AMOUNT);
    const transactionThreadReport = useTransactionThreadReport();
    const parentReportID = useParentReportID();
    const policyID = useTransactionPolicyID();
    const taxViolations = useFieldViolationMessages('tax');

    const [parentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${parentReportID}`);
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`);

    const isPolicyExpenseChat = isReportInGroupPolicy(parentReport, policy);
    const isExpenseUnreported = isExpenseUnreportedTransactionUtils(transaction);
    const isDistanceRequest = isDistanceRequestTransactionUtils(transaction);
    const isPerDiemRequest = isPerDiemRequestTransactionUtils(transaction);
    const isTimeRequest = isTimeRequestTransactionUtils(transaction);

    const isTaxEnabled = isTaxTrackingEnabled(isPolicyExpenseChat || isExpenseUnreported, policy, isDistanceRequest, isPerDiemRequest, isTimeRequest);
    const shouldShowTaxDisabledAlert = !isTaxEnabled && !!transaction?.taxCode && !isTimeRequest && !isPerDiemRequest;
    const shouldShow = isTaxEnabled || shouldShowTaxDisabledAlert;

    if (!shouldShow) {
        return null;
    }

    const canEditTaxFields = canEditTaxRate && !isDistanceRequest;
    const taxRates = policy?.taxRates;
    const taxRatesDescription = taxRates?.name;
    const taxRateTitle = getTaxName(policy, transaction, isExpenseUnreported);
    const {taxCode, taxValue} = transaction ?? {};
    const selectedPolicyTaxValue = taxCode ? policy?.taxRates?.taxes?.[taxCode]?.value : undefined;
    const hasTaxValueChanged = taxCode && taxValue !== undefined ? selectedPolicyTaxValue !== taxValue : false;
    const fallbackTaxRateTitle = transaction?.taxValue;
    const taxRateValue = hasTaxValueChanged ? taxValue : (transaction?.taxName ?? taxRateTitle ?? fallbackTaxRateTitle ?? '');
    const taxRateCopyValue = !canEditTaxFields ? taxRateValue : undefined;

    const transactionCurrency = transaction?.currency;
    const formattedTaxAmount = convertToDisplayString(Math.abs(transaction?.taxAmount ?? 0), transactionCurrency);
    const taxAmountTitle = formattedTaxAmount ? formattedTaxAmount.toString() : '';
    const taxAmountCopyValue = !canEditTaxFields ? taxAmountTitle : undefined;

    const violationsError = taxViolations.length > 0 ? `${taxViolations.map((v) => v.name).join('. ')}.` : '';
    const brickRoadIndicator = violationsError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined;

    function onPressRate() {
        if (!transaction?.transactionID || !transactionThreadReport?.reportID) {
            return;
        }
        Navigation.navigate(
            ROUTES.MONEY_REQUEST_STEP_TAX_RATE.getRoute(CONST.IOU.ACTION.EDIT, CONST.IOU.TYPE.SUBMIT, transaction.transactionID, transactionThreadReport.reportID, getReportRHPActiveRoute()),
        );
    }

    function onPressAmount() {
        if (!transaction?.transactionID || !transactionThreadReport?.reportID) {
            return;
        }
        Navigation.navigate(
            ROUTES.MONEY_REQUEST_STEP_TAX_AMOUNT.getRoute(
                CONST.IOU.ACTION.EDIT,
                CONST.IOU.TYPE.SUBMIT,
                transaction.transactionID,
                transactionThreadReport.reportID,
                getReportRHPActiveRoute(),
            ),
        );
    }

    return (
        <>
            <FieldRow
                pendingAction={transaction?.pendingFields?.taxCode}
                title={taxRateValue?.toString() ?? ''}
                description={taxRatesDescription ?? translate('common.tax')}
                numberOfLinesTitle={2}
                interactive={canEditTaxFields}
                shouldShowRightIcon={canEditTaxFields}
                onPress={onPressRate}
                brickRoadIndicator={brickRoadIndicator}
                errorText={violationsError}
                copyValue={typeof taxRateCopyValue === 'string' ? taxRateCopyValue : undefined}
                copyable={!!taxRateCopyValue}
            />
            <FieldRow
                pendingAction={transaction?.pendingFields?.taxAmount}
                title={taxAmountTitle}
                description={translate('iou.taxAmount')}
                numberOfLinesTitle={2}
                interactive={canEditTaxAmount && !isDistanceRequest}
                shouldShowRightIcon={canEditTaxAmount && !isDistanceRequest}
                onPress={onPressAmount}
                copyValue={taxAmountCopyValue}
                copyable={!!taxAmountCopyValue}
            />
        </>
    );
}

function TaxRowSnapshot() {
    const {translate} = useLocalize();
    const {convertToDisplayString} = useCurrencyListActions();
    const taxName = useSnapshotTransactionField((tx: Transaction) => tx?.taxName);
    const taxAmount = useSnapshotTransactionField((tx: Transaction) => tx?.taxAmount);
    const currency = useSnapshotTransactionField((tx: Transaction) => tx?.currency);

    if (!taxName && !taxAmount) {
        return null;
    }

    const taxAmountTitle = taxAmount !== undefined ? (convertToDisplayString(Math.abs(taxAmount), currency)?.toString() ?? '') : '';

    return (
        <>
            {!!taxName && (
                <FieldRow
                    description={translate('common.tax')}
                    title={taxName}
                    numberOfLinesTitle={2}
                    interactive={false}
                    shouldShowRightIcon={false}
                />
            )}
            {!!taxAmountTitle && (
                <FieldRow
                    description={translate('iou.taxAmount')}
                    title={taxAmountTitle}
                    numberOfLinesTitle={2}
                    interactive={false}
                    shouldShowRightIcon={false}
                />
            )}
        </>
    );
}

export {TaxRow, TaxRowSnapshot};
