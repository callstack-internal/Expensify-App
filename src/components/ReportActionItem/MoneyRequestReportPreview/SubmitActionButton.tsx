import {delegateEmailSelector} from '@selectors/Account';
import {isTrackIntentUserSelector} from '@selectors/Onboarding';
import React, {useCallback, useMemo} from 'react';
import type {OnyxCollection} from 'react-native-onyx';
import AnimatedSubmitButton from '@components/AnimatedSubmitButton';
import useConfirmModal from '@hooks/useConfirmModal';
import useConfirmPendingRTERAndProceed from '@hooks/useConfirmPendingRTERAndProceed';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import usePermissions from '@hooks/usePermissions';
import useReportTransactionsCollection from '@hooks/useReportTransactionsCollection';
import {hasDynamicExternalWorkflow} from '@libs/PolicyUtils';
import {hasViolations as hasViolationsReportUtils, shouldShowMarkAsDone} from '@libs/ReportUtils';
import {hasAnyPendingRTERViolation as hasAnyPendingRTERViolationTransactionUtils, hasOnlyPendingCardTransactions, showPendingCardTransactionsBlockModal} from '@libs/TransactionUtils';
import {submitReport} from '@userActions/IOU/ReportWorkflow';
import {markPendingRTERTransactionsAsCash} from '@userActions/Transaction';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import {personalDetailsLoginSelector} from '@src/selectors/PersonalDetails';
import {transactionViolationsByIDsSelector} from '@src/selectors/TransactionViolations';
import type {Transaction, TransactionViolations} from '@src/types/onyx';
import {useReportPreviewActions, useReportPreviewAnimationState, useReportPreviewData} from './MoneyRequestReportPreviewContext';

function SubmitActionButton() {
    const {translate} = useLocalize();
    const {showConfirmModal} = useConfirmModal();
    const currentUserDetails = useCurrentUserPersonalDetails();
    const currentUserAccountID = currentUserDetails.accountID;
    const currentUserEmail = currentUserDetails.email ?? '';
    const {isBetaEnabled} = usePermissions();

    const {iouReportID} = useReportPreviewData();
    const {isSubmittingAnimationRunning} = useReportPreviewAnimationState();
    const {stopAnimation, startSubmittingAnimation} = useReportPreviewActions();

    const [iouReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${iouReportID}`);
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${iouReport?.policyID}`);
    const [submitterLogin] = useOnyx(ONYXKEYS.PERSONAL_DETAILS_LIST, {selector: personalDetailsLoginSelector(iouReport?.ownerAccountID)}, [iouReport?.ownerAccountID]);
    const [userBillingGracePeriodEnds] = useOnyx(ONYXKEYS.COLLECTION.SHARED_NVP_PRIVATE_USER_BILLING_GRACE_PERIOD_END);
    const [iouReportNextStep] = useOnyx(`${ONYXKEYS.COLLECTION.NEXT_STEP}${iouReportID}`);
    const [amountOwed] = useOnyx(ONYXKEYS.NVP_PRIVATE_AMOUNT_OWED);
    const [ownerBillingGracePeriodEnd] = useOnyx(ONYXKEYS.NVP_PRIVATE_OWNER_BILLING_GRACE_PERIOD_END);
    const [reportActions] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${iouReportID}`);
    const [isTrackIntentUser] = useOnyx(ONYXKEYS.NVP_INTRO_SELECTED, {selector: isTrackIntentUserSelector});
    const [delegateEmail] = useOnyx(ONYXKEYS.ACCOUNT, {selector: delegateEmailSelector});
    const {isOffline} = useNetwork();
    const isDEWSubmission = hasDynamicExternalWorkflow(policy);
    const reportTransactionsCollection = useReportTransactionsCollection(iouReportID);
    const transactions = Object.values(reportTransactionsCollection ?? {}).filter(
        (t): t is Transaction => !!t && (isOffline || t.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE),
    );

    // Subscribe only to the violations of this report's transactions instead of the whole collection,
    // so a violation change in an unrelated report does not re-render this button.
    const transactionIDs = useMemo(() => transactions.map((transaction) => transaction.transactionID), [transactions]);
    const selectTransactionViolations = useCallback(
        (allViolations: OnyxCollection<TransactionViolations>) => transactionViolationsByIDsSelector(transactionIDs)(allViolations),
        [transactionIDs],
    );
    const [transactionViolations] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS, {selector: selectTransactionViolations}, [transactionIDs]);

    const isASAPSubmitBetaEnabled = isBetaEnabled(CONST.BETAS.ASAP_SUBMIT);
    const hasViolations = hasViolationsReportUtils(iouReport?.reportID, transactionViolations, currentUserAccountID, currentUserEmail);
    const hasAnyPendingRTERViolation = hasAnyPendingRTERViolationTransactionUtils(transactions, transactionViolations, currentUserEmail, currentUserAccountID, iouReport, policy);

    const handleMarkPendingRTERTransactionsAsCash = () => {
        markPendingRTERTransactionsAsCash(transactions, transactionViolations, Object.values(reportActions ?? {}));
    };

    const confirmPendingRTERAndProceed = useConfirmPendingRTERAndProceed(hasAnyPendingRTERViolation, handleMarkPendingRTERTransactionsAsCash);
    const shouldUseMarkAsDoneCopy = shouldShowMarkAsDone({
        isTrackIntentUser,
        report: iouReport,
        policy,
    });
    return (
        <AnimatedSubmitButton
            success
            text={shouldUseMarkAsDoneCopy ? translate('common.markAsDone') : translate('common.submit')}
            isMarkAsDone={shouldUseMarkAsDoneCopy}
            onPress={() => {
                if (hasOnlyPendingCardTransactions(transactions)) {
                    showPendingCardTransactionsBlockModal(showConfirmModal, translate);
                    return;
                }
                confirmPendingRTERAndProceed(() => {
                    submitReport({
                        expenseReport: iouReport,
                        policy,
                        currentUserAccountIDParam: currentUserAccountID,
                        currentUserEmailParam: currentUserEmail,
                        hasViolations,
                        isASAPSubmitBetaEnabled,
                        expenseReportCurrentNextStepDeprecated: iouReportNextStep,
                        userBillingGracePeriodEnds,
                        amountOwed,
                        onSubmitted: startSubmittingAnimation,
                        ownerBillingGracePeriodEnd,
                        delegateEmail,
                        submitterLogin,
                    });
                });
            }}
            isSubmittingAnimationRunning={isSubmittingAnimationRunning}
            onAnimationFinish={stopAnimation}
            isDEWSubmission={isDEWSubmission}
            reportID={iouReportID}
            sentryLabel={CONST.SENTRY_LABEL.REPORT_PREVIEW.SUBMIT_BUTTON}
        />
    );
}

export default SubmitActionButton;
