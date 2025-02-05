import type {OnyxCollection} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, TransactionViolation} from '@src/types/onyx';
import {shouldDisplayViolationsRBRInLHN} from './ReportUtils';

const reportsMetadata = {
    cacheKey: 'reportsMetadata',

    // Function that computes the value based on dependencies
    compute: (reports: OnyxCollection<Report>, transactionViolations: OnyxCollection<TransactionViolation[]>) => {
        const metadata: Record<string, {doesReportHaveViolations: boolean}> = {};
        Object.entries(reports ?? {}).forEach(([, report]) => {
            if (!report) {
                return;
            }

            metadata[report.reportID] = {
                doesReportHaveViolations: shouldDisplayViolationsRBRInLHN(report, transactionViolations),
            };
        });
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
