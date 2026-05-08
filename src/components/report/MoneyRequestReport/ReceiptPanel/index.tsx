import React from 'react';
import {View} from 'react-native';
import useThemeStyles from '@hooks/useThemeStyles';
import ReceiptPanelSkeleton from './ReceiptPanelSkeleton';

type ReceiptPanelProps = {
    /** Identity of the multi-transaction money-request report whose receipt this panel serves. */
    reportID: string | undefined;
};

/**
 * Always-rendered receipt panel for `MoneyRequestReport`. Because the dispatcher
 * mounts this compound only when `transactionCount > 1`, the panel never needs an
 * internal "single-transaction → null" branch — that case is served by the
 * `TransactionThread` compound, not this one.
 *
 * The visible footprint mirrors the panel slot today's `MoneyRequestReportView`
 * reserves via `WideRHPReceiptPanel`; a follow-up slice replaces that integration
 * with this block driven by `useReceipt()` from `ReceiptContextProvider`.
 *
 * Renders the skeleton when no `reportID` is available; renders the panel surface
 * once an id is in hand. This block is `useRoute`-free per the no-route-in-blocks
 * contract — the shell forwards `reportID` as a prop.
 */
function ReceiptPanel({reportID}: ReceiptPanelProps) {
    const styles = useThemeStyles();
    if (!reportID) {
        return <ReceiptPanelSkeleton />;
    }
    return (
        <View
            style={styles.flex1}
            testID="MoneyRequestReport.ReceiptPanel"
        />
    );
}

ReceiptPanel.displayName = 'MoneyRequestReport.ReceiptPanel';

export default ReceiptPanel;
