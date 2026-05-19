import React from 'react';
import useActiveRoute from '@hooks/useActiveRoute';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import usePolicyForMovingExpenses from '@hooks/usePolicyForMovingExpenses';
import {getDecodedCategoryName, isCategoryMissing} from '@libs/CategoryUtils';
import {hasEnabledOptions} from '@libs/OptionsListUtils';
import {isReportInGroupPolicy} from '@libs/ReportUtils';
import {isCategoryBeingAnalyzed, isExpenseUnreported as isExpenseUnreportedTransactionUtils} from '@libs/TransactionUtils';
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

function CategoryRow() {
    const {translate} = useLocalize();
    const {getReportRHPActiveRoute} = useActiveRoute();

    const transaction = useLiveTransactionField((tx: Transaction) => tx);
    const canEdit = useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.CATEGORY);
    const transactionThreadReport = useTransactionThreadReport();
    const parentReportID = useParentReportID();
    const policyID = useTransactionPolicyID();
    const violationMessages = useFieldViolationMessages('category');

    const [parentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${parentReportID}`);
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`);
    const [policyCategories] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_CATEGORIES}${policyID}`);
    const isExpenseUnreported = isExpenseUnreportedTransactionUtils(transaction);
    const {policyForMovingExpenses, shouldSelectPolicy} = usePolicyForMovingExpenses();

    const isPolicyExpenseChat = isReportInGroupPolicy(parentReport, policy);
    const category = transaction?.category ?? '';
    const categoryForDisplay = isCategoryMissing(category) ? '' : category;
    const shouldShow =
        (isPolicyExpenseChat && (!!categoryForDisplay || hasEnabledOptions(policyCategories ?? {}))) ||
        (isExpenseUnreported && (!policyForMovingExpenses || hasEnabledOptions(policyCategories ?? {})));

    if (!shouldShow) {
        return null;
    }

    const decodedCategoryName = getDecodedCategoryName(categoryForDisplay);
    const shouldShowCategoryAnalyzing = isCategoryBeingAnalyzed(transaction);
    const title = shouldShowCategoryAnalyzing ? translate('common.analyzing') : decodedCategoryName;
    const categoryCopyValue = !canEdit ? decodedCategoryName : undefined;
    const violationsError = violationMessages.length > 0 ? `${violationMessages.map((v) => v.name).join('. ')}.` : '';
    const brickRoadIndicator = violationsError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined;
    const shouldNavigateToUpgradePath = !policyForMovingExpenses && !shouldSelectPolicy;

    function onPress() {
        if (!transaction?.transactionID || !transactionThreadReport?.reportID) {
            return;
        }
        if (shouldNavigateToUpgradePath) {
            Navigation.navigate(
                ROUTES.MONEY_REQUEST_UPGRADE.getRoute({
                    action: CONST.IOU.ACTION.EDIT,
                    iouType: CONST.IOU.TYPE.SUBMIT,
                    transactionID: transaction.transactionID,
                    reportID: transactionThreadReport.reportID,
                    upgradePath: CONST.UPGRADE_PATHS.CATEGORIES,
                    backTo: ROUTES.MONEY_REQUEST_STEP_CATEGORY.getRoute(
                        CONST.IOU.ACTION.EDIT,
                        CONST.IOU.TYPE.SUBMIT,
                        transaction.transactionID,
                        transactionThreadReport.reportID,
                        Navigation.getActiveRoute(),
                    ),
                }),
            );
            return;
        }
        if (!policyID && shouldSelectPolicy) {
            Navigation.navigate(
                ROUTES.SET_DEFAULT_WORKSPACE.getRoute(
                    ROUTES.MONEY_REQUEST_STEP_CATEGORY.getRoute(
                        CONST.IOU.ACTION.EDIT,
                        CONST.IOU.TYPE.SUBMIT,
                        transaction.transactionID,
                        transactionThreadReport.reportID,
                        Navigation.getActiveRoute(),
                    ),
                ),
            );
            return;
        }
        Navigation.navigate(
            ROUTES.MONEY_REQUEST_STEP_CATEGORY.getRoute(CONST.IOU.ACTION.EDIT, CONST.IOU.TYPE.SUBMIT, transaction.transactionID, transactionThreadReport.reportID, getReportRHPActiveRoute()),
        );
    }

    return (
        <FieldRow
            pendingAction={transaction?.pendingFields?.category}
            description={translate('common.category')}
            title={title}
            numberOfLinesTitle={2}
            interactive={canEdit}
            shouldShowRightIcon={canEdit}
            onPress={onPress}
            brickRoadIndicator={brickRoadIndicator}
            errorText={violationsError}
            copyValue={categoryCopyValue}
            copyable={!!categoryCopyValue}
        />
    );
}

function CategoryRowSnapshot() {
    const {translate} = useLocalize();
    const category = useSnapshotTransactionField((tx: Transaction) => tx?.category ?? '');

    if (!category || isCategoryMissing(category)) {
        return null;
    }

    return (
        <FieldRow
            description={translate('common.category')}
            title={getDecodedCategoryName(category)}
            numberOfLinesTitle={2}
            interactive={false}
            shouldShowRightIcon={false}
        />
    );
}

export {CategoryRow, CategoryRowSnapshot};
