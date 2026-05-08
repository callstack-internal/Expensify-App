import React from 'react';
import ReportHeaderSkeletonView from '@components/ReportHeaderSkeletonView';

/**
 * Skeleton shown by `MoneyRequestReport.Header` when the underlying report record
 * is null. Reuses the existing report-header skeleton so the visual footprint
 * matches today's `MoneyReportHeader` placeholder while the report hydrates.
 */
function HeaderSkeleton() {
    return (
        <ReportHeaderSkeletonView
            shouldAnimate
            reasonAttributes={{context: 'MoneyRequestReport.HeaderSkeleton'}}
        />
    );
}

HeaderSkeleton.displayName = 'MoneyRequestReport.HeaderSkeleton';

export default HeaderSkeleton;
