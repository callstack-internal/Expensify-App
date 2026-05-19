import React from 'react';
import useActiveRoute from '@hooks/useActiveRoute';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import {hasEnabledOptions} from '@libs/OptionsListUtils';
import {getTagLists, hasDependentTags as hasDependentTagsPolicyUtils} from '@libs/PolicyUtils';
import {isReportInGroupPolicy} from '@libs/ReportUtils';
import {hasEnabledTags, shouldShowDependentTagList} from '@libs/TagsOptionsListUtils';
import {getTagForDisplay, isExpenseUnreported as isExpenseUnreportedTransactionUtils} from '@libs/TransactionUtils';
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
import isNextDependentLevelToFill from './isNextDependentLevelToFill';

function TagRows() {
    const {translate} = useLocalize();
    const {getReportRHPActiveRoute} = useActiveRoute();

    const transaction = useLiveTransactionField((tx: Transaction) => tx);
    const canEdit = useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.TAG);
    const transactionThreadReport = useTransactionThreadReport();
    const parentReportID = useParentReportID();
    const policyID = useTransactionPolicyID();
    const violationMessages = useFieldViolationMessages('tag');

    const [parentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${parentReportID}`);
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`);
    const [policyTagList] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_TAGS}${policyID}`);

    const policyTagLists = getTagLists(policyTagList);
    const isPolicyExpenseChat = isReportInGroupPolicy(parentReport, policy);
    const isExpenseUnreported = isExpenseUnreportedTransactionUtils(transaction);
    const transactionTag = transaction?.tag;
    const hasDependentTags = hasDependentTagsPolicyUtils(policy, policyTagList);

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const shouldShow = (isPolicyExpenseChat || isExpenseUnreported) && (transactionTag || (canEdit && hasEnabledTags(policyTagLists)));
    if (!shouldShow) {
        return null;
    }

    return (
        <>
            {policyTagLists.map(({name, orderWeight, tags}, index) => {
                const tagForDisplay = getTagForDisplay(transaction, index);
                let shouldShowList = false;
                if (hasDependentTags) {
                    shouldShowList = shouldShowDependentTagList(index, transactionTag, tags);
                } else {
                    shouldShowList = !!tagForDisplay || (canEdit && hasEnabledOptions(tags ?? {}));
                }
                if (!shouldShowList) {
                    return null;
                }

                const tagError = violationMessages.length > 0 ? `${violationMessages.map((v) => v.name).join('. ')}.` : '';
                const tagCopyValue = !canEdit ? tagForDisplay : undefined;
                const highlighted = hasDependentTags && isNextDependentLevelToFill(transaction, index, policyTagLists);

                function onPress() {
                    if (!transaction?.transactionID || !transactionThreadReport?.reportID) {
                        return;
                    }
                    Navigation.navigate(
                        ROUTES.MONEY_REQUEST_STEP_TAG.getRoute(
                            CONST.IOU.ACTION.EDIT,
                            CONST.IOU.TYPE.SUBMIT,
                            orderWeight,
                            transaction.transactionID,
                            transactionThreadReport.reportID,
                            getReportRHPActiveRoute(),
                        ),
                    );
                }

                return (
                    <FieldRow
                        key={name}
                        pendingAction={transaction?.pendingFields?.tag}
                        highlighted={highlighted}
                        description={name ?? translate('common.tag')}
                        title={tagForDisplay}
                        numberOfLinesTitle={2}
                        interactive={canEdit}
                        shouldShowRightIcon={canEdit}
                        onPress={onPress}
                        brickRoadIndicator={tagError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined}
                        errorText={tagError}
                        copyValue={tagCopyValue}
                        copyable={!!tagCopyValue}
                    />
                );
            })}
        </>
    );
}

function TagRowsSnapshot() {
    const {translate} = useLocalize();
    const transaction = useSnapshotTransactionField((tx: Transaction) => tx);
    const policyID = useTransactionPolicyID();
    const [policyTagList] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_TAGS}${policyID}`);
    const policyTagLists = getTagLists(policyTagList);

    if (!transaction?.tag || policyTagLists.length === 0) {
        return null;
    }

    return (
        <>
            {policyTagLists.map(({name}, index) => {
                const tagForDisplay = getTagForDisplay(transaction, index);
                if (!tagForDisplay) {
                    return null;
                }
                return (
                    <FieldRow
                        key={name}
                        description={name ?? translate('common.tag')}
                        title={tagForDisplay}
                        numberOfLinesTitle={2}
                        interactive={false}
                        shouldShowRightIcon={false}
                    />
                );
            })}
        </>
    );
}

export {TagRows, TagRowsSnapshot};
