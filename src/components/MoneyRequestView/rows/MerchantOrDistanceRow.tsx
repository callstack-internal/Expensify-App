import React from 'react';
import useActiveRoute from '@hooks/useActiveRoute';
import {useCurrencyListActions} from '@hooks/useCurrencyList';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useDistanceRateOriginalPolicy from '@hooks/useDistanceRateOriginalPolicy';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import DistanceRequestUtils from '@libs/DistanceRequestUtils';
import {getTransactionDetails} from '@libs/ReportUtils';
import {
    getDistanceInMeters,
    hasRoute as hasRouteTransactionUtils,
    isDistanceRequest as isDistanceRequestTransactionUtils,
    isExpenseUnreported as isExpenseUnreportedTransactionUtils,
    isManualDistanceRequest as isManualDistanceRequestTransactionUtils,
    isOdometerDistanceRequest as isOdometerDistanceRequestTransactionUtils,
    isScanning,
} from '@libs/TransactionUtils';
import {isInvalidMerchantValue} from '@libs/ValidationUtils';
import Navigation from '@navigation/Navigation';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Transaction} from '@src/types/onyx';
import {useLiveTransactionField} from '../contexts/LiveTransactionProvider';
import {useSnapshotTransactionField} from '../contexts/SnapshotTransactionProvider';
import {useFieldEditPermission, useTransactionThreadReport} from '../contexts/ThreadProvider';
import {useTransactionPolicyID} from '../contexts/TransactionPolicyContext';
import {useFieldViolationMessages} from '../contexts/ViolationsProvider';
import FieldRow from '../FieldRow';

function MerchantOrDistanceRow() {
    const {translate, toLocaleDigit} = useLocalize();
    const {getCurrencySymbol} = useCurrencyListActions();
    const {getReportRHPActiveRoute} = useActiveRoute();
    const {isOffline} = useNetwork();
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();

    const transaction = useLiveTransactionField((tx: Transaction) => tx);
    const canEditMerchant = useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.MERCHANT);
    const canEditDistance = useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.DISTANCE);
    const canEditDistanceRate = useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.DISTANCE_RATE);
    const transactionThreadReport = useTransactionThreadReport();
    const policyID = useTransactionPolicyID();
    const merchantViolations = useFieldViolationMessages('merchant');

    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`);

    const isDistanceRequest = isDistanceRequestTransactionUtils(transaction);
    const isExpenseUnreported = isExpenseUnreportedTransactionUtils(transaction);
    const distanceOriginalPolicy = useDistanceRateOriginalPolicy(isDistanceRequest && isExpenseUnreported ? transaction?.comment?.customUnit?.customUnitRateID : undefined);

    const details = getTransactionDetails(transaction, undefined, undefined, false, false, currentUserPersonalDetails);
    const transactionMerchant = details?.merchant;
    const transactionAmount = details?.amount;
    const transactionCurrency = details?.currency;

    const isTransactionScanning = isScanning(transaction);
    const isManualDistanceRequest = isManualDistanceRequestTransactionUtils(transaction);
    const isOdometerDistanceRequest = isOdometerDistanceRequestTransactionUtils(transaction);

    if (isDistanceRequest) {
        const effectivePolicy = distanceOriginalPolicy ?? policy;
        const {unit, rate, name: rateName} = DistanceRequestUtils.getRate({transaction, policy: effectivePolicy});
        const hasRoute = hasRouteTransactionUtils(transaction, isDistanceRequest);
        const distance = getDistanceInMeters(transaction, unit);
        const currency = transactionCurrency ?? CONST.CURRENCY.USD;
        const isCustomUnitOutOfPolicy = isDistanceRequest && !rate;
        const calculateFromTransactionData = !rate;
        const distanceUnit = calculateFromTransactionData ? transaction?.comment?.customUnit?.distanceUnit : unit;
        const distanceRate = calculateFromTransactionData ? (transactionAmount ?? 0) / (transaction?.comment?.customUnit?.quantity ?? 1) : rate;
        const rateToDisplay = DistanceRequestUtils.getRateForExpenseDisplay(
            rateName,
            isCustomUnitOutOfPolicy,
            distanceUnit,
            distanceRate,
            currency,
            translate,
            toLocaleDigit,
            getCurrencySymbol,
            isOffline,
        );
        const distanceToDisplay = DistanceRequestUtils.getDistanceForDisplay(hasRoute, distance, unit, rate, translate, undefined, isManualDistanceRequest);

        const distanceCopyValue = !canEditDistance ? distanceToDisplay : undefined;
        const rateCopyValue = !canEditDistanceRate ? rateToDisplay : undefined;

        function onPressDistance() {
            if (!transaction?.transactionID || !transactionThreadReport?.reportID) {
                return;
            }
            if (isOdometerDistanceRequest) {
                Navigation.navigate(
                    ROUTES.MONEY_REQUEST_STEP_DISTANCE_ODOMETER.getRoute(CONST.IOU.ACTION.EDIT, CONST.IOU.TYPE.SUBMIT, transaction.transactionID, transactionThreadReport.reportID),
                );
                return;
            }
            if (isManualDistanceRequest) {
                Navigation.navigate(
                    ROUTES.MONEY_REQUEST_STEP_DISTANCE_MANUAL.getRoute(
                        CONST.IOU.ACTION.EDIT,
                        CONST.IOU.TYPE.SUBMIT,
                        transaction.transactionID,
                        transactionThreadReport.reportID,
                        getReportRHPActiveRoute(),
                    ),
                );
                return;
            }
            Navigation.navigate(
                ROUTES.MONEY_REQUEST_STEP_DISTANCE.getRoute(
                    CONST.IOU.ACTION.EDIT,
                    CONST.IOU.TYPE.SUBMIT,
                    transaction.transactionID,
                    transactionThreadReport.reportID,
                    getReportRHPActiveRoute(),
                ),
            );
        }

        function onPressRate() {
            if (!transaction?.transactionID || !transactionThreadReport?.reportID) {
                return;
            }
            Navigation.navigate(
                ROUTES.MONEY_REQUEST_STEP_DISTANCE_RATE.getRoute(
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
                    pendingAction={transaction?.pendingFields?.waypoints ?? transaction?.pendingFields?.merchant}
                    description={translate('common.distance')}
                    title={distanceToDisplay}
                    numberOfLinesTitle={2}
                    interactive={canEditDistance}
                    shouldShowRightIcon={canEditDistance}
                    onPress={onPressDistance}
                    copyValue={distanceCopyValue}
                    copyable={!!distanceCopyValue}
                />
                <FieldRow
                    pendingAction={transaction?.pendingFields?.customUnitRateID}
                    description={translate('common.rate')}
                    title={rateToDisplay}
                    numberOfLinesTitle={2}
                    interactive={canEditDistanceRate}
                    shouldShowRightIcon={canEditDistanceRate}
                    onPress={onPressRate}
                    copyValue={rateCopyValue}
                    copyable={!!rateCopyValue}
                />
            </>
        );
    }

    const isEmptyMerchant = isInvalidMerchantValue(transactionMerchant);
    let merchantTitle = isEmptyMerchant ? '' : (transactionMerchant ?? '');
    if (isTransactionScanning) {
        merchantTitle = translate('iou.receiptStatusTitle');
    }

    const violationsError = merchantViolations.length > 0 ? `${merchantViolations.map((v) => v.name).join('. ')}.` : '';
    const brickRoadIndicator = violationsError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined;
    const merchantCopyValue = !canEditMerchant ? merchantTitle : undefined;

    function onPressMerchant() {
        if (!transaction?.transactionID || !transactionThreadReport?.reportID) {
            return;
        }
        Navigation.navigate(
            ROUTES.MONEY_REQUEST_STEP_MERCHANT.getRoute(CONST.IOU.ACTION.EDIT, CONST.IOU.TYPE.SUBMIT, transaction.transactionID, transactionThreadReport.reportID, getReportRHPActiveRoute()),
        );
    }

    return (
        <FieldRow
            pendingAction={transaction?.pendingFields?.merchant}
            description={translate('common.merchant')}
            title={merchantTitle}
            interactive={canEditMerchant}
            shouldShowRightIcon={canEditMerchant}
            onPress={onPressMerchant}
            brickRoadIndicator={brickRoadIndicator}
            errorText={violationsError}
            numberOfLinesTitle={0}
            copyValue={merchantCopyValue}
            copyable={!!merchantCopyValue}
        />
    );
}

function MerchantOrDistanceRowSnapshot() {
    const {translate} = useLocalize();
    const transaction = useSnapshotTransactionField((tx: Transaction) => tx);
    const isDistanceRequest = isDistanceRequestTransactionUtils(transaction);

    if (isDistanceRequest) {
        const distance = getDistanceInMeters(transaction, transaction?.comment?.customUnit?.distanceUnit);
        const hasRoute = hasRouteTransactionUtils(transaction, true);
        const distanceToDisplay = DistanceRequestUtils.getDistanceForDisplay(hasRoute, distance, transaction?.comment?.customUnit?.distanceUnit, undefined, translate);
        return (
            <FieldRow
                description={translate('common.distance')}
                title={distanceToDisplay}
                numberOfLinesTitle={2}
                interactive={false}
                shouldShowRightIcon={false}
            />
        );
    }

    const merchant = transaction?.merchant;
    if (!merchant || isInvalidMerchantValue(merchant)) {
        return null;
    }

    return (
        <FieldRow
            description={translate('common.merchant')}
            title={merchant}
            interactive={false}
            shouldShowRightIcon={false}
            numberOfLinesTitle={0}
        />
    );
}

export {MerchantOrDistanceRow, MerchantOrDistanceRowSnapshot};
