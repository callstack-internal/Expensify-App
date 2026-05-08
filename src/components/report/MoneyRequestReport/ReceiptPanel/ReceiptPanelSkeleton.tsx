import React from 'react';
import {View} from 'react-native';
import useThemeStyles from '@hooks/useThemeStyles';

/**
 * Skeleton shown by `MoneyRequestReport.ReceiptPanel` when the panel does not yet
 * have a receipt-target transaction (or that transaction has not hydrated yet).
 *
 * The visible footprint is intentionally minimal — this slice's panel is mounted
 * but does not yet wire receipt rendering through the new compound-row pattern;
 * a follow-up slice replaces today's `WideRHPReceiptPanel` integration with
 * `ReceiptPanel` driven by `useReceipt()`.
 */
function ReceiptPanelSkeleton() {
    const styles = useThemeStyles();
    return (
        <View
            style={[styles.flex1]}
            testID="MoneyRequestReport.ReceiptPanelSkeleton"
        />
    );
}

ReceiptPanelSkeleton.displayName = 'MoneyRequestReport.ReceiptPanelSkeleton';

export default ReceiptPanelSkeleton;
