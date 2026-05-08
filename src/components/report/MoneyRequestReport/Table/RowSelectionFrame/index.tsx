import type {ReactNode} from 'react';
import React from 'react';
import {View} from 'react-native';
import {useSearchStateContext} from '@components/Search/SearchContext';
import useThemeStyles from '@hooks/useThemeStyles';

type RowSelectionFrameProps = {
    /** Identity of the transaction this frame wraps. */
    transactionID: string;

    /** Row content — the `RowContent` block. */
    children: ReactNode;
};

/**
 * Per-row selection frame. Subscribes to `selectedTransactionIDs` from the tree-wide
 * `SearchContext` and applies a selection style only to the rows whose `transactionID`
 * is currently selected. The wrapped content stays unaware of the selection state, so
 * a selection change re-renders only the affected frames, never the row content
 * itself.
 *
 * Selection state lives in `SearchContext` because it must survive cross-screen
 * navigation (per PRD "Coordination state — concrete per-compound providers");
 * external-context coupling is acceptable when natural.
 */
function RowSelectionFrame({transactionID, children}: RowSelectionFrameProps) {
    const styles = useThemeStyles();
    const {selectedTransactionIDs} = useSearchStateContext();
    const isSelected = selectedTransactionIDs.includes(transactionID);

    return <View style={isSelected ? styles.activeComponentBG : undefined}>{children}</View>;
}

RowSelectionFrame.displayName = 'MoneyRequestReport.Table.RowSelectionFrame';

export default RowSelectionFrame;
