// Consumer rows must layer these composite overlays on top of the per-field
// permission exposed here (variant identity is encoded by which shell mounts;
// the provider only knows base writability):
//   - isGPSDistanceRequest (gates amount/distance edits)
//   - canEditDistanceOrRate (policy-accessibility + track-expense + p2p distance)
//   - shouldShowSplitIndicator && isSplitAvailable (amount edit override)
//   - per-diem submission gates on the REPORT field
import React, {createContext, useContext} from 'react';
import type {ValueOf} from 'type-fest';
import useOnyx from '@hooks/useOnyx';
import useReportIsArchived from '@hooks/useReportIsArchived';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {isMoneyRequestAction} from '@libs/ReportActionsUtils';
import {canEditFieldOfMoneyRequest, canEditMoneyRequest, canUserPerformWriteAction} from '@libs/ReportUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, Transaction} from '@src/types/onyx';

type TransactionField = ValueOf<typeof CONST.EDIT_REQUEST_FIELD>;

type PermissionMap = Record<TransactionField, boolean> & {canEdit: boolean};

type ThreadContextValue = {
    parentReportID: string | undefined;
    transactionThreadReport: Report | undefined;
    permission: PermissionMap;
};

const ThreadContext = createContext<ThreadContextValue | null>(null);

type ThreadProviderProps = {
    parentReportID: string | undefined;
    transactionThreadReportID: string | undefined;
    policyID: string | undefined;
    transaction: Transaction | undefined;
    children: React.ReactNode;
};

function buildPermissionMap(): PermissionMap {
    return {
        canEdit: false,
        [CONST.EDIT_REQUEST_FIELD.AMOUNT]: false,
        [CONST.EDIT_REQUEST_FIELD.CURRENCY]: false,
        [CONST.EDIT_REQUEST_FIELD.DATE]: false,
        [CONST.EDIT_REQUEST_FIELD.DESCRIPTION]: false,
        [CONST.EDIT_REQUEST_FIELD.MERCHANT]: false,
        [CONST.EDIT_REQUEST_FIELD.CATEGORY]: false,
        [CONST.EDIT_REQUEST_FIELD.RECEIPT]: false,
        [CONST.EDIT_REQUEST_FIELD.DISTANCE]: false,
        [CONST.EDIT_REQUEST_FIELD.DISTANCE_RATE]: false,
        [CONST.EDIT_REQUEST_FIELD.TAG]: false,
        [CONST.EDIT_REQUEST_FIELD.TAX_RATE]: false,
        [CONST.EDIT_REQUEST_FIELD.TAX_AMOUNT]: false,
        [CONST.EDIT_REQUEST_FIELD.REIMBURSABLE]: false,
        [CONST.EDIT_REQUEST_FIELD.BILLABLE]: false,
        [CONST.EDIT_REQUEST_FIELD.REPORT]: false,
    };
}

function ThreadProvider({parentReportID, transactionThreadReportID, policyID, transaction, children}: ThreadProviderProps) {
    const [parentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${parentReportID}`);
    const [transactionThreadReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${transactionThreadReportID}`);
    const [parentReportActions] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${parentReportID}`);
    const [,/* parentReportNextStep */] = useOnyx(`${ONYXKEYS.COLLECTION.NEXT_STEP}${getNonEmptyStringOnyxID(parentReport?.reportID)}`);
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`);
    const [outstandingReportsByPolicyID] = useOnyx(ONYXKEYS.DERIVED.OUTSTANDING_REPORTS_BY_POLICY_ID);

    const isReportArchived = useReportIsArchived(transactionThreadReport?.reportID);
    const isChatReportArchived = useReportIsArchived(parentReport?.chatReportID);

    const parentReportAction = transactionThreadReport?.parentReportActionID ? parentReportActions?.[transactionThreadReport.parentReportActionID] : undefined;

    const isEditable = !!canUserPerformWriteAction(transactionThreadReport, isReportArchived);
    const canEdit = isMoneyRequestAction(parentReportAction) && canEditMoneyRequest(parentReportAction, transaction, isChatReportArchived, parentReport, policy) && isEditable;

    const permission = buildPermissionMap();
    permission.canEdit = canEdit;

    const fieldNames = Object.values(CONST.EDIT_REQUEST_FIELD);
    for (const field of fieldNames) {
        if (!isEditable) {
            permission[field] = false;
            continue;
        }
        permission[field] = canEditFieldOfMoneyRequest({
            reportAction: parentReportAction,
            fieldToEdit: field,
            isChatReportArchived,
            outstandingReportsByPolicyID,
            transaction,
            report: parentReport,
            policy,
        });
    }

    const value: ThreadContextValue = {
        parentReportID,
        transactionThreadReport,
        permission,
    };

    return <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>;
}

function useThreadContext(): ThreadContextValue {
    const ctx = useContext(ThreadContext);
    if (!ctx) {
        throw new Error('ThreadProvider missing');
    }
    return ctx;
}

function useFieldEditPermission(field: TransactionField): boolean {
    return useThreadContext().permission[field];
}

function useTransactionThreadReport(): Report | undefined {
    return useThreadContext().transactionThreadReport;
}

function useParentReportID(): string | undefined {
    return useThreadContext().parentReportID;
}

export default ThreadProvider;
export {useFieldEditPermission, useTransactionThreadReport, useParentReportID};
export type {TransactionField};
