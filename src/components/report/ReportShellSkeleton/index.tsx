import React from 'react';
import {View} from 'react-native';
import ReportActionsSkeletonView from '@components/ReportActionsSkeletonView';
import useThemeStyles from '@hooks/useThemeStyles';

/**
 * Kind-agnostic skeleton rendered by `ReportKindDispatcher` when the report record is
 * still null and we therefore cannot pick a compound. Reuses the existing chat-action
 * skeleton lines so the visual footprint matches today's loading state.
 */
function ReportShellSkeleton() {
    const styles = useThemeStyles();
    return (
        <View style={[styles.flex1, styles.justifyContentEnd, styles.overflowHidden]}>
            <ReportActionsSkeletonView />
        </View>
    );
}

ReportShellSkeleton.displayName = 'ReportShellSkeleton';

export default ReportShellSkeleton;
