import type {ReactNode} from 'react';
import React from 'react';
import {View} from 'react-native';
import {useReceipt} from '@components/report/MoneyRequestReport/ReceiptContextProvider/ReceiptContext';
import useThemeStyles from '@hooks/useThemeStyles';

type RowHighlightFrameProps = {
    /** Identity of the transaction this frame wraps. */
    transactionID: string;

    /** Row content — the `RowContent` block (and any inner frames). */
    children: ReactNode;
};

/**
 * Per-row receipt-highlight frame. Subscribes to `useReceipt()` and applies a
 * highlight style only to the row whose `transactionID` matches the current target.
 * The wrapped content stays unaware of the highlight state, so a target change
 * re-renders only the two affected frames (the previously-highlighted row and the
 * newly-highlighted row), never the row content itself.
 *
 * Per the compound-row pattern (PRD "Per-row state — compound-row pattern"),
 * subscription cost is proportional to subscriber render size: N tiny frames
 * = N tiny renders. This frame is tiny by construction.
 */
function RowHighlightFrame({transactionID, children}: RowHighlightFrameProps) {
    const styles = useThemeStyles();
    const receipt = useReceipt();
    const isHighlighted = receipt === transactionID;

    return <View style={isHighlighted ? styles.highlightBG : undefined}>{children}</View>;
}

RowHighlightFrame.displayName = 'MoneyRequestReport.Table.RowHighlightFrame';

export default RowHighlightFrame;
