import React from 'react';
import ReportHeaderSkeletonView from '@components/ReportHeaderSkeletonView';

/**
 * Skeleton shown by `ChatReport.Header` when the underlying report record is null.
 * Reuses the existing report header skeleton so the visual footprint matches
 * today's `HeaderView` placeholder while the report hydrates.
 */
function HeaderSkeleton() {
    return (
        <ReportHeaderSkeletonView
            shouldAnimate
            reasonAttributes={{context: 'ChatReport.HeaderSkeleton'}}
        />
    );
}

HeaderSkeleton.displayName = 'ChatReport.HeaderSkeleton';

export default HeaderSkeleton;
