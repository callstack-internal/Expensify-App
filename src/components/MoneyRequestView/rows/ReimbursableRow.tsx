import {Str} from 'expensify-common';
import React from 'react';
import {View} from 'react-native';
import {useLiveTransactionField} from '@components/MoneyRequestView/contexts/LiveTransactionProvider';
import {useSnapshotTransactionField} from '@components/MoneyRequestView/contexts/SnapshotTransactionProvider';
import {useFieldEditPermission, useParentReportID, useTransactionThreadReport} from '@components/MoneyRequestView/contexts/ThreadProvider';
import {useTransactionPolicyID} from '@components/MoneyRequestView/contexts/TransactionPolicyContext';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import Switch from '@components/Switch';
import Text from '@components/Text';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import usePermissions from '@hooks/usePermissions';
import useThemeStyles from '@hooks/useThemeStyles';
import {updateMoneyRequestReimbursable} from '@libs/actions/IOU/UpdateMoneyRequest';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {isInvoiceReport, isReportInGroupPolicy} from '@libs/ReportUtils';
import {getReimbursable, isExpenseUnreported as isExpenseUnreportedTransactionUtils, isManagedCardTransaction as isManagedCardTransactionTransactionUtils} from '@libs/TransactionUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Transaction} from '@src/types/onyx';

function ReimbursableRow() {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const {isBetaEnabled} = usePermissions();
    const isASAPSubmitBetaEnabled = isBetaEnabled(CONST.BETAS.ASAP_SUBMIT);

    const transaction = useLiveTransactionField((tx: Transaction) => tx);
    const canEditReimbursable = useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.REIMBURSABLE);
    const transactionThreadReport = useTransactionThreadReport();
    const parentReportID = useParentReportID();
    const policyID = useTransactionPolicyID();

    const [parentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${parentReportID}`);
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`);
    const [policyTagList] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_TAGS}${policyID}`);
    const [policyCategories] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_CATEGORIES}${policyID}`);
    const [parentReportNextStep] = useOnyx(`${ONYXKEYS.COLLECTION.NEXT_STEP}${getNonEmptyStringOnyxID(parentReport?.reportID)}`);

    const isPolicyExpenseChat = isReportInGroupPolicy(parentReport, policy);
    const isExpenseUnreported = isExpenseUnreportedTransactionUtils(transaction);
    const isInvoice = isInvoiceReport(parentReport);
    const transactionReimbursable = transaction?.reimbursable;

    const isReimbursableDifferentFromPolicyDefault = policy?.defaultReimbursable !== undefined && !!transactionReimbursable !== policy.defaultReimbursable;
    const shouldShow =
        (isPolicyExpenseChat || (isExpenseUnreported && !!policy)) &&
        (policy?.disabledFields?.reimbursable !== true || isReimbursableDifferentFromPolicyDefault) &&
        !isManagedCardTransactionTransactionUtils(transaction) &&
        !isInvoice;

    if (!shouldShow) {
        return null;
    }

    function onToggle(newReimbursable: boolean) {
        if (newReimbursable === getReimbursable(transaction) || !transaction?.transactionID || !transactionThreadReport?.reportID) {
            return;
        }
        updateMoneyRequestReimbursable({
            transactionID: transaction.transactionID,
            transactionThreadReport,
            parentReport,
            value: newReimbursable,
            policy,
            policyTagList,
            policyCategories,
            currentUserAccountIDParam: currentUserPersonalDetails.accountID,
            currentUserEmailParam: currentUserPersonalDetails.login ?? '',
            isASAPSubmitBetaEnabled,
            parentReportNextStep,
        });
    }

    return (
        <OfflineWithFeedback
            pendingAction={transaction?.pendingFields?.reimbursable}
            contentContainerStyle={[styles.flexRow, styles.optionRow, styles.justifyContentBetween, styles.alignItemsCenter, styles.mh5]}
        >
            <View>
                <Text
                    accessible={false}
                    aria-hidden
                >
                    {Str.UCFirst(translate('iou.reimbursable'))}
                </Text>
            </View>
            <Switch
                accessibilityLabel={Str.UCFirst(translate('iou.reimbursable'))}
                isOn={!!transactionReimbursable}
                onToggle={onToggle}
                disabled={!canEditReimbursable}
            />
        </OfflineWithFeedback>
    );
}

function ReimbursableRowSnapshot() {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const reimbursable = useSnapshotTransactionField((tx: Transaction) => tx?.reimbursable);

    return (
        <OfflineWithFeedback contentContainerStyle={[styles.flexRow, styles.optionRow, styles.justifyContentBetween, styles.alignItemsCenter, styles.mh5]}>
            <View>
                <Text
                    accessible={false}
                    aria-hidden
                >
                    {Str.UCFirst(translate('iou.reimbursable'))}
                </Text>
            </View>
            <Switch
                accessibilityLabel={Str.UCFirst(translate('iou.reimbursable'))}
                isOn={!!reimbursable}
                onToggle={() => undefined}
                disabled
            />
        </OfflineWithFeedback>
    );
}

export {ReimbursableRow, ReimbursableRowSnapshot};
