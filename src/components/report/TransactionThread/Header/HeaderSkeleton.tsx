import React from 'react';
import ReportHeaderSkeletonView from '@components/ReportHeaderSkeletonView';

/**
 * Skeleton shown by `TransactionThread.Header` when the underlying report record
 * is null. Reuses the existing report header skeleton so the visual footprint
 * matches today's `MoneyRequestHeader` placeholder while the report hydrates.
 */
function HeaderSkeleton() {
    return (
        <ReportHeaderSkeletonView
            shouldAnimate
            reasonAttributes={{context: 'TransactionThread.HeaderSkeleton'}}
        />
    );
}

HeaderSkeleton.displayName = 'TransactionThread.HeaderSkeleton';

export default HeaderSkeleton;
