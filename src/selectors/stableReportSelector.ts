import type {OnyxEntry} from 'react-native-onyx';
import type {Report} from '@src/types/onyx';

/**
 * Stable `Report` projection for the `ReportActionItem` subtree.
 *
 * `last*` heartbeat fields are deliberately excluded: they update on routine activity
 * (incoming/outgoing messages, read receipts) and would invalidate the projection on every
 * chat heartbeat even though no item-subtree consumer reads them.
 *
 */
function stableReportSelector(report: OnyxEntry<Report>) {
    if (!report?.reportID) {
        return undefined;
    }
    return {
        reportID: report.reportID,
        avatarUrl: report.avatarUrl,
        created: report.created,
        submitted: report.submitted,
        approved: report.approved,
        chatType: report.chatType,
        hasOutstandingChildRequest: report.hasOutstandingChildRequest,
        hasOutstandingChildTask: report.hasOutstandingChildTask,
        isOwnPolicyExpenseChat: report.isOwnPolicyExpenseChat,
        isPinned: report.isPinned,
        // lastMessageText: report.lastMessageText,
        // lastVisibleActionCreated: report.lastVisibleActionCreated,
        // lastReadTime: report.lastReadTime,
        // lastReadSequenceNumber: report.lastReadSequenceNumber,
        // lastMentionedTime: report.lastMentionedTime,
        policyAvatar: report.policyAvatar,
        policyName: report.policyName,
        oldPolicyName: report.oldPolicyName,
        hasParentAccess: report.hasParentAccess,
        description: report.description,
        isDeletedParentAction: report.isDeletedParentAction,
        policyID: report.policyID,
        reportName: report.reportName,
        chatReportID: report.chatReportID,
        stateNum: report.stateNum,
        statusNum: report.statusNum,
        writeCapability: report.writeCapability,
        type: report.type,
        visibility: report.visibility,
        invoiceReceiver: report.invoiceReceiver,
        transactionCount: report.transactionCount,
        parentReportID: report.parentReportID,
        parentReportActionID: report.parentReportActionID,
        // Coerce sentinel `0` to `undefined`. The backend ships `managerID: 0` on chat reports
        // without a manager, and a later push removes the key entirely; treating both as
        // `undefined` keeps the projection stable through that reconciliation.
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        managerID: report.managerID || undefined,
        // lastVisibleActionLastModified: report.lastVisibleActionLastModified,
        // lastMessageHtml: report.lastMessageHtml,
        // lastActorAccountID: report.lastActorAccountID,
        // lastActionType: report.lastActionType,
        ownerAccountID: report.ownerAccountID,
        participants: report.participants,
        total: report.total,
        unheldTotal: report.unheldTotal,
        unheldNonReimbursableTotal: report.unheldNonReimbursableTotal,
        currency: report.currency,
        errorFields: report.errorFields,
        errors: report.errors,
        isWaitingOnBankAccount: report.isWaitingOnBankAccount,
        isCancelledIOU: report.isCancelledIOU,
        hasReportBeenRetracted: report.hasReportBeenRetracted,
        hasReportBeenReopened: report.hasReportBeenReopened,
        isExportedToIntegration: report.isExportedToIntegration,
        hasExportError: report.hasExportError,
        iouReportID: report.iouReportID,
        preexistingReportID: report.preexistingReportID,
        nonReimbursableTotal: report.nonReimbursableTotal,
        privateNotes: report.privateNotes,
        fieldList: report.fieldList,
        permissions: report.permissions,
        tripData: report.tripData,
        welcomeMessage: report.welcomeMessage,
        nextStep: report.nextStep,
        pendingAction: report.pendingAction,
        pendingFields: report.pendingFields,
    };
}

export default stableReportSelector;
