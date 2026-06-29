import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import useReportIsArchived from '@hooks/useReportIsArchived';
import {getConnectedIntegration, hasDynamicExternalWorkflow} from '@libs/PolicyUtils';
import {hasPendingDEWSubmit} from '@libs/ReportActionsUtils';
import getReportPreviewAction from '@libs/ReportPreviewActionUtils';
import {canIOUBePaid as canIOUBePaidIOUActions} from '@userActions/IOU/ReportWorkflow';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Policy, Report, Transaction, TransactionViolations} from '@src/types/onyx';
import type {ReportPreviewActionState} from './MoneyRequestReportPreviewContext';

type UseReportPreviewActionDecisionParams = {
    iouReportID: string | undefined;
    chatReportID: string | undefined;
    iouReport: OnyxEntry<Report>;
    chatReport: OnyxEntry<Report>;
    policy: OnyxEntry<Policy>;
    invoiceReceiverPolicy: OnyxEntry<Policy>;
    transactions: Transaction[];
    transactionViolations: OnyxCollection<TransactionViolations>;
    isPaidAnimationRunning: boolean;
    isApprovedAnimationRunning: boolean;
    isSubmittingAnimationRunning: boolean;
};

/**
 * Owns the "which action button to show" decision for the money request report preview. Lives in the provider so the
 * decision is computed once from the preview subject and exposed via context, instead of being recomputed by the
 * dispatcher and the pay button.
 */
function useReportPreviewActionDecision({
    iouReportID,
    chatReportID,
    iouReport,
    chatReport,
    policy,
    invoiceReceiverPolicy,
    transactions,
    transactionViolations,
    isPaidAnimationRunning,
    isApprovedAnimationRunning,
    isSubmittingAnimationRunning,
}: UseReportPreviewActionDecisionParams): ReportPreviewActionState {
    const currentUserDetails = useCurrentUserPersonalDetails();
    const {isOffline} = useNetwork();
    const isIouReportArchived = useReportIsArchived(iouReportID);
    const isChatReportArchived = useReportIsArchived(chatReportID);
    const [bankAccountList] = useOnyx(ONYXKEYS.BANK_ACCOUNT_LIST);
    const [iouReportMetadata] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_METADATA}${iouReportID}`);

    const settleableTransactions = transactions.filter((transaction) => isOffline || transaction.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE);

    const isDEWPolicy = hasDynamicExternalWorkflow(policy);
    const isDEWSubmitPending = hasPendingDEWSubmit(iouReportMetadata, isDEWPolicy);
    const connectedIntegration = getConnectedIntegration(policy);

    const canIOUBePaid = canIOUBePaidIOUActions(
        iouReport,
        chatReport,
        policy,
        bankAccountList,
        currentUserDetails.login ?? '',
        currentUserDetails.accountID,
        settleableTransactions,
        false,
        undefined,
        invoiceReceiverPolicy,
    );
    const onlyShowPayElsewhere =
        !canIOUBePaid &&
        canIOUBePaidIOUActions(
            iouReport,
            chatReport,
            policy,
            bankAccountList,
            currentUserDetails.login ?? '',
            currentUserDetails.accountID,
            settleableTransactions,
            true,
            undefined,
            invoiceReceiverPolicy,
        );
    const shouldShowPayButton = isPaidAnimationRunning || canIOUBePaid || onlyShowPayElsewhere;

    const reportPreviewAction = getReportPreviewAction({
        isReportArchived: isIouReportArchived || isChatReportArchived,
        currentUserAccountID: currentUserDetails.accountID,
        currentUserLogin: currentUserDetails.login ?? '',
        report: iouReport,
        policy,
        transactions: settleableTransactions,
        bankAccountList,
        invoiceReceiverPolicy,
        isPaidAnimationRunning,
        isApprovedAnimationRunning,
        isSubmittingAnimationRunning,
        isDEWSubmitPending,
        violationsData: transactionViolations,
        reportMetadata: iouReportMetadata,
    });

    return {reportPreviewAction, canIOUBePaid, onlyShowPayElsewhere, shouldShowPayButton, connectedIntegration};
}

export default useReportPreviewActionDecision;
