import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';
import type {Policy, Report, Transaction, TransactionViolation, TransactionViolations} from '@src/types/onyx';
import type {ReportTransactionsAndViolationsDerivedValue} from '@src/types/onyx/DerivedValues';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {isViolationDismissed, shouldShowViolation} from '@libs/TransactionUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import getEmptyArray from '@src/types/utils/getEmptyArray';

/**
 * Computes filtered transaction violations for a single transaction
 */
function computeTransactionViolations(
    transactionID: string,
    allReportsTransactionsAndViolations: OnyxEntry<ReportTransactionsAndViolationsDerivedValue>,
    allReports: OnyxCollection<Report>,
    allPolicies: OnyxCollection<Policy>,
    shouldShowRterForSettledReport = true,
): TransactionViolations {
    if (!transactionID || !allReportsTransactionsAndViolations) {
        return getEmptyArray<TransactionViolation>();
    }

    const transactionKey = `${ONYXKEYS.COLLECTION.TRANSACTION}${getNonEmptyStringOnyxID(transactionID)}`;
    
    // Find transaction data from shared context
    let transaction: Transaction | null = null;
    for (const reportData of Object.values(allReportsTransactionsAndViolations ?? {})) {
        if (reportData?.transactions?.[transactionKey]) {
            transaction = reportData.transactions[transactionKey];
            break;
        }
    }

    if (!transaction || !transaction.reportID) {
        return getEmptyArray<TransactionViolation>();
    }

    // Find violation data from shared context
    const violationKey = `${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${transactionID}`;
    const reportData = allReportsTransactionsAndViolations[transaction.reportID];
    const transactionViolations = reportData?.violations?.[violationKey] ?? getEmptyArray<TransactionViolation>();

    // Get report and policy data
    const reportKey = `${ONYXKEYS.COLLECTION.REPORT}${transaction.reportID}`;
    const iouReport = allReports?.[reportKey] ?? undefined;
    const policyKey = iouReport?.policyID ? `${ONYXKEYS.COLLECTION.POLICY}${iouReport.policyID}` : undefined;
    const policy = policyKey && allPolicies?.[policyKey] ? allPolicies[policyKey] : undefined;

    // Filter violations using the same logic as the original hook
    return transactionViolations.filter(
        (violation: TransactionViolation) => 
            !isViolationDismissed(transaction, violation) && 
            shouldShowViolation(iouReport, policy, violation.name, shouldShowRterForSettledReport),
    );
}

/**
 * Batch computes violations for multiple transactions
 */
function computeTransactionViolationsBatch(
    transactionIDs: string[],
    allReportsTransactionsAndViolations: OnyxEntry<ReportTransactionsAndViolationsDerivedValue>,
    allReports: OnyxCollection<Report>,
    allPolicies: OnyxCollection<Policy>,
    shouldShowRterForSettledReport = true,
): Record<string, TransactionViolations> {
    const result: Record<string, TransactionViolations> = {};
    
    for (const transactionID of transactionIDs) {
        result[transactionID] = computeTransactionViolations(
            transactionID,
            allReportsTransactionsAndViolations,
            allReports,
            allPolicies,
            shouldShowRterForSettledReport,
        );
    }
    
    return result;
}

export {computeTransactionViolations, computeTransactionViolationsBatch};