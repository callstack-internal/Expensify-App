import {deepEqual} from 'fast-equals';
import {useMemo, useState} from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import type {Report} from '@src/types/onyx';

/**
 * Stable `Report` projection for the `ReportActionItem` subtree.
 * Per-field `useMemo` deps so the ref holds across Onyx pushes when consumed fields are unchanged.
 *
 * Never add — heartbeat-style fields that update on routine activity and defeat the memo:
 *   - lastReadTime, lastVisibleActionCreated, lastVisibleActionLastModified
 *   - lastMessageText, lastMessageHtml
 *   - lastActorAccountID, lastActionType
 *
 */
function useStableReportForReportActionItem(report: OnyxEntry<Report>): OnyxEntry<Report> {
    const reportID = report?.reportID;
    const chatReportID = report?.chatReportID;
    const isWaitingOnBankAccount = report?.isWaitingOnBankAccount;

    // Stabilize `permissions` by content
    const permissionsRaw = report?.permissions;
    const [permissions, setPermissions] = useState(permissionsRaw);
    if (!deepEqual(permissions, permissionsRaw)) {
        setPermissions(permissionsRaw);
    }

    const policyID = report?.policyID;
    const ownerAccountID = report?.ownerAccountID;
    const parentReportID = report?.parentReportID;
    const parentReportActionID = report?.parentReportActionID;
    const type = report?.type;
    const chatType = report?.chatType;
    const stateNum = report?.stateNum;
    const statusNum = report?.statusNum;
    const isDeletedParentAction = report?.isDeletedParentAction;
    const pendingFields = report?.pendingFields;
    const participants = report?.participants;
    const errorFields = report?.errorFields;
    const reportName = report?.reportName;
    const description = report?.description;
    // Coerce sentinel `0` to `undefined`. The backend ships `managerID: 0` on chat reports without a manager, and a later push removes the key entirely; treating both as `undefined` keeps the memo dep stable through that reconciliation.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const managerID = report?.managerID || undefined;
    const total = report?.total;
    const nonReimbursableTotal = report?.nonReimbursableTotal;
    const policyAvatar = report?.policyAvatar;
    const fieldList = report?.fieldList;
    const iouReportID = report?.iouReportID;
    const isCancelledIOU = report?.isCancelledIOU;
    const isOwnPolicyExpenseChat = report?.isOwnPolicyExpenseChat;
    const writeCapability = report?.writeCapability;
    const currency = report?.currency;
    const visibility = report?.visibility;
    const avatarUrl = report?.avatarUrl;
    const policyName = report?.policyName;
    const transactionCount = report?.transactionCount;
    const unheldTotal = report?.unheldTotal;
    const created = report?.created;

    return useMemo(() => {
        if (reportID === undefined) {
            return undefined;
        }
        return {
            reportID,
            chatReportID,
            isWaitingOnBankAccount,
            permissions,
            policyID,
            ownerAccountID,
            parentReportID,
            parentReportActionID,
            type,
            chatType,
            stateNum,
            statusNum,
            isDeletedParentAction,
            pendingFields,
            participants,
            errorFields,
            reportName,
            description,
            managerID,
            total,
            nonReimbursableTotal,
            policyAvatar,
            fieldList,
            iouReportID,
            isCancelledIOU,
            isOwnPolicyExpenseChat,
            writeCapability,
            currency,
            visibility,
            avatarUrl,
            policyName,
            transactionCount,
            unheldTotal,
            created,
        } as Report;
    }, [
        reportID,
        chatReportID,
        isWaitingOnBankAccount,
        permissions,
        policyID,
        ownerAccountID,
        parentReportID,
        parentReportActionID,
        type,
        chatType,
        stateNum,
        statusNum,
        isDeletedParentAction,
        pendingFields,
        participants,
        errorFields,
        reportName,
        description,
        managerID,
        total,
        nonReimbursableTotal,
        policyAvatar,
        fieldList,
        iouReportID,
        isCancelledIOU,
        isOwnPolicyExpenseChat,
        writeCapability,
        currency,
        visibility,
        avatarUrl,
        policyName,
        transactionCount,
        unheldTotal,
        created,
    ]);
}

export default useStableReportForReportActionItem;
