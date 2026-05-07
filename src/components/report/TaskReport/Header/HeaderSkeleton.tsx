import React from 'react';
import ReportHeaderSkeletonView from '@components/ReportHeaderSkeletonView';

/**
 * Skeleton shown by `TaskReport.Header` when the underlying report record is null.
 * Reuses the existing report header skeleton so the visual footprint matches today.
 */
function HeaderSkeleton() {
    return (
        <ReportHeaderSkeletonView
            shouldAnimate
            reasonAttributes={{context: 'TaskReport.HeaderSkeleton'}}
        />
    );
}

HeaderSkeleton.displayName = 'TaskReport.HeaderSkeleton';

export default HeaderSkeleton;
