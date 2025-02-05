import type {OnyxCollection} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, TransactionViolation} from '@src/types/onyx';
import {hasValidDraftComment} from './DraftCommentUtils';
import {getReportAction} from './ReportActionsUtils';
import {
    getReportName,
    hasReportErrorsOtherThanFailedReceipt,
    isHiddenForCurrentUser,
    isOneTransactionThread,
    requiresAttentionFromCurrentUser,
    shouldDisplayViolationsRBRInLHN,
} from './ReportUtils';

const reportsMetadata = {
    cacheKey: 'reportsMetadata',

    // Function that computes the value based on dependencies
    compute: (reports: OnyxCollection<Report>, transactionViolations: OnyxCollection<TransactionViolation[]>) => {
        const metadata: Record<string, {doesReportHaveViolations: boolean}> = {};
        Object.entries(reports ?? {}).forEach(([, report]) => {
            if (!report) {
                return;
            }

            const doesHaveViolations = shouldDisplayViolationsRBRInLHN(report, transactionViolations);
            const isHidden = isHiddenForCurrentUser(report);
            const hasErrorsOtherThanFailedReceipt = hasReportErrorsOtherThanFailedReceipt(report, doesHaveViolations, transactionViolations);
            const hasValidDraft = hasValidDraftComment(report.reportID);
            const parentReportAction = getReportAction(report?.parentReportID, report?.parentReportActionID);
            const requiresAttention = requiresAttentionFromCurrentUser(report, parentReportAction);
            const isOneTransaction = isOneTransactionThread(report.reportID, report.parentReportID, parentReportAction);
            const reportName = getReportName(report);
            metadata[report.reportID] = {
                doesReportHaveViolations: doesHaveViolations,
                isHiddenForCurrentUser: isHidden,
                hasErrorsOtherThanFailedReceipt,
                hasValidDraft,
                requiresAttention,
                parentReportAction,
                isOneTransactionThread: isOneTransaction,
                reportName,
            };
        });
        // console.log('metadata', metadata);
        return metadata;
    },

    dependencies: [ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS],
};

const stats = {
    cacheKey: 'stats',
    compute: (reports: Record<string, any>, transactions: Record<string, any>) => ({
        reportCount: Object.keys(reports || {}).length,
        transactionCount: Object.keys(transactions || {}).length,
    }),
    dependencies: [ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.COLLECTION.TRANSACTION],
};

export {reportsMetadata, stats};
