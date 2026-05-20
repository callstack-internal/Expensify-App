import React from 'react';
import {View} from 'react-native';
import {useLiveTransactionField} from '@components/MoneyRequestView/contexts/LiveTransactionProvider';
import {useSnapshotTransactionField} from '@components/MoneyRequestView/contexts/SnapshotTransactionProvider';
import {useCanEditTransaction, useParentReportID, useTransactionThreadReport} from '@components/MoneyRequestView/contexts/ThreadProvider';
import {useTransactionPolicyID} from '@components/MoneyRequestView/contexts/TransactionPolicyContext';
import {useAllViolations, useFieldViolationMessages} from '@components/MoneyRequestView/contexts/ViolationsProvider';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import Switch from '@components/Switch';
import Text from '@components/Text';
import ViolationMessages from '@components/ViolationMessages';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useEnvironment from '@hooks/useEnvironment';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import usePermissions from '@hooks/usePermissions';
import useThemeStyles from '@hooks/useThemeStyles';
import {updateMoneyRequestBillable} from '@libs/actions/IOU/UpdateMoneyRequest';
import {getBrokenConnectionUrlToFixPersonalCard} from '@libs/CardUtils';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {isMarkAsCashActionForTransaction} from '@libs/ReportPrimaryActionUtils';
import {isReportInGroupPolicy} from '@libs/ReportUtils';
import {getBillable, isExpenseUnreported as isExpenseUnreportedTransactionUtils} from '@libs/TransactionUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Transaction} from '@src/types/onyx';

function BillableRow() {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const {isOffline} = useNetwork();
    const {environmentURL} = useEnvironment();
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const {isBetaEnabled} = usePermissions();
    const isASAPSubmitBetaEnabled = isBetaEnabled(CONST.BETAS.ASAP_SUBMIT);

    const transaction = useLiveTransactionField((tx: Transaction) => tx);
    const canEdit = useCanEditTransaction();
    const transactionThreadReport = useTransactionThreadReport();
    const parentReportID = useParentReportID();
    const policyID = useTransactionPolicyID();
    const billableViolations = useFieldViolationMessages('billable');
    const allViolations = useAllViolations();

    const [parentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${parentReportID}`);
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`);
    const [policyTagList] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_TAGS}${policyID}`);
    const [policyCategories] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_CATEGORIES}${policyID}`);
    const [parentReportNextStep] = useOnyx(`${ONYXKEYS.COLLECTION.NEXT_STEP}${getNonEmptyStringOnyxID(parentReport?.reportID)}`);
    const [cardFeedErrors] = useOnyx(ONYXKEYS.DERIVED.CARD_FEED_ERRORS, {
        selector: (data) => data?.personalCardsWithBrokenConnection ?? {},
    });

    const isPolicyExpenseChat = isReportInGroupPolicy(parentReport, policy);
    const isExpenseUnreported = isExpenseUnreportedTransactionUtils(transaction);
    const transactionBillable = transaction?.billable;

    const shouldShow = (isPolicyExpenseChat || isExpenseUnreported) && (!!transactionBillable || !(policy?.disabledFields?.defaultBillable ?? true));
    if (!shouldShow) {
        return null;
    }

    const violationsError = billableViolations.length > 0;
    const isMarkAsCash = parentReport && currentUserPersonalDetails.login ? isMarkAsCashActionForTransaction(currentUserPersonalDetails.login, parentReport, allViolations, policy) : false;
    const companyCardPageURL = `${environmentURL}/${ROUTES.WORKSPACE_COMPANY_CARDS.getRoute(transactionThreadReport?.policyID)}`;
    const connectionLink = getBrokenConnectionUrlToFixPersonalCard(cardFeedErrors ?? {}, environmentURL);

    function onToggle(newBillable: boolean) {
        if (newBillable === getBillable(transaction) || !transaction?.transactionID || !transactionThreadReport?.reportID) {
            return;
        }
        updateMoneyRequestBillable({
            transactionID: transaction.transactionID,
            transactionThreadReport,
            parentReport,
            value: newBillable,
            policy,
            policyTagList,
            policyCategories,
            currentUserAccountIDParam: currentUserPersonalDetails.accountID,
            currentUserEmailParam: currentUserPersonalDetails.login ?? '',
            isASAPSubmitBetaEnabled,
            parentReportNextStep,
            isOffline,
        });
    }

    return (
        <OfflineWithFeedback
            pendingAction={transaction?.pendingFields?.billable}
            contentContainerStyle={[styles.flexRow, styles.optionRow, styles.justifyContentBetween, styles.alignItemsCenter, styles.mh5]}
        >
            <View>
                <Text
                    accessible={false}
                    aria-hidden
                >
                    {translate('common.billable')}
                </Text>
                {violationsError && (
                    <ViolationMessages
                        violations={billableViolations}
                        containerStyle={[styles.mt1]}
                        textStyle={[styles.ph0]}
                        isLast
                        isMarkAsCash={isMarkAsCash}
                        canEdit={canEdit}
                        companyCardPageURL={companyCardPageURL}
                        connectionLink={connectionLink}
                        routeDistanceMeters={transaction?.comment?.customUnit?.routeDistanceMeters}
                        distanceUnit={transaction?.comment?.customUnit?.distanceUnit}
                    />
                )}
            </View>
            <Switch
                accessibilityLabel={translate('common.billable')}
                isOn={!!transactionBillable}
                onToggle={onToggle}
                disabled={!canEdit}
            />
        </OfflineWithFeedback>
    );
}

function BillableRowSnapshot() {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const billable = useSnapshotTransactionField((tx: Transaction) => tx?.billable);

    return (
        <OfflineWithFeedback contentContainerStyle={[styles.flexRow, styles.optionRow, styles.justifyContentBetween, styles.alignItemsCenter, styles.mh5]}>
            <View>
                <Text
                    accessible={false}
                    aria-hidden
                >
                    {translate('common.billable')}
                </Text>
            </View>
            <Switch
                accessibilityLabel={translate('common.billable')}
                isOn={!!billable}
                onToggle={() => undefined}
                disabled
            />
        </OfflineWithFeedback>
    );
}

export {BillableRow, BillableRowSnapshot};
