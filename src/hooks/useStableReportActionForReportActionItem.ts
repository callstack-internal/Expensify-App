import {useMemo} from 'react';
import {getOriginalMessage} from '@libs/ReportActionsUtils';
import type {ReportAction} from '@src/types/onyx';

/**
 * Stable `ReportAction` projection for the `ReportActionItem` subtree, with `originalMessage` precomputed.
 * Per-field `useMemo` deps so the ref holds when consumed fields are unchanged.
 * Allow-list — when a descendant reads a new `reportAction.*` field, add it here.
 */
function useStableReportActionForReportActionItem(reportAction: ReportAction): ReportAction {
    const reportActionID = reportAction.reportActionID;
    const message = reportAction.message;
    const pendingAction = reportAction.pendingAction;
    const actionName = reportAction.actionName;
    const errors = reportAction.errors;
    const childCommenterCount = reportAction.childCommenterCount;
    const linkMetadata = reportAction.linkMetadata;
    const childReportID = reportAction.childReportID;
    const childLastVisibleActionCreated = reportAction.childLastVisibleActionCreated;
    const error = reportAction.error;
    const created = reportAction.created;
    const actorAccountID = reportAction.actorAccountID;
    const adminAccountID = reportAction.adminAccountID;
    const childVisibleActionCount = reportAction.childVisibleActionCount;
    const childOldestFourAccountIDs = reportAction.childOldestFourAccountIDs;
    const childType = reportAction.childType;
    const person = reportAction.person;
    const isOptimisticAction = reportAction.isOptimisticAction;
    const delegateAccountID = reportAction.delegateAccountID;
    const previousMessage = reportAction.previousMessage;
    const isAttachmentWithText = reportAction.isAttachmentWithText;
    const isOriginalReportDeleted = reportAction.isOriginalReportDeleted;
    const childStateNum = reportAction.childStateNum;
    const childStatusNum = reportAction.childStatusNum;
    const childReportName = reportAction.childReportName;
    const childManagerAccountID = reportAction.childManagerAccountID;
    const childMoneyRequestCount = reportAction.childMoneyRequestCount;
    const childOwnerAccountID = reportAction.childOwnerAccountID;

    const originalMessage = useMemo(() => getOriginalMessage(reportAction), [reportAction]);

    return useMemo(
        () =>
            ({
                reportActionID,
                message,
                pendingAction,
                actionName,
                errors,
                originalMessage,
                childCommenterCount,
                linkMetadata,
                childReportID,
                childLastVisibleActionCreated,
                error,
                created,
                actorAccountID,
                adminAccountID,
                childVisibleActionCount,
                childOldestFourAccountIDs,
                childType,
                person,
                isOptimisticAction,
                delegateAccountID,
                previousMessage,
                isAttachmentWithText,
                isOriginalReportDeleted,
                childStateNum,
                childStatusNum,
                childReportName,
                childManagerAccountID,
                childMoneyRequestCount,
                childOwnerAccountID,
            }) as ReportAction,
        [
            reportActionID,
            message,
            pendingAction,
            actionName,
            errors,
            originalMessage,
            childCommenterCount,
            linkMetadata,
            childReportID,
            childLastVisibleActionCreated,
            error,
            created,
            actorAccountID,
            adminAccountID,
            childVisibleActionCount,
            childOldestFourAccountIDs,
            childType,
            person,
            isOptimisticAction,
            delegateAccountID,
            previousMessage,
            isAttachmentWithText,
            isOriginalReportDeleted,
            childStateNum,
            childStatusNum,
            childReportName,
            childManagerAccountID,
            childMoneyRequestCount,
            childOwnerAccountID,
        ],
    );
}

export default useStableReportActionForReportActionItem;
