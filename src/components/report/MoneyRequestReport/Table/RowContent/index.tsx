import React from 'react';
import {PressableWithoutFeedback} from '@components/Pressable';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';
import type {Transaction} from '@src/types/onyx';

type RowContentProps = {
    /** The transaction this row renders. */
    transaction: Transaction;

    /** Click handler — fired when the row is pressed. */
    onClick: (transactionID: string) => void;
};

/**
 * Inert row body. Receives `transaction` and `onClick` as props; deliberately knows
 * nothing about receipt-target or selection state. The `RowHighlightFrame` and
 * `RowSelectionFrame` wrappers own those subscriptions, so this component never
 * re-renders on shared-state changes (verified by render-counter spy in tests).
 *
 * The visible footprint is intentionally minimal in this slice — production wiring
 * inside today's `MoneyRequestReportActionsList` continues to render its own row
 * component. This block exists to (a) give the compound a stable `RowContent` test
 * surface, (b) anchor the compound-row pattern's "content unaware of subscriptions"
 * contract for follow-up slices that lift today's row into this position.
 */
function RowContent({transaction, onClick}: RowContentProps) {
    const styles = useThemeStyles();

    return (
        <PressableWithoutFeedback
            onPress={() => onClick(transaction.transactionID)}
            style={styles.p3}
            accessibilityLabel={transaction.merchant ?? transaction.transactionID}
            role="button"
            sentryLabel="MoneyRequestReport-RowContent"
            testID={`MoneyRequestReport.RowContent.${transaction.transactionID}`}
        >
            <Text>{transaction.merchant ?? transaction.transactionID}</Text>
        </PressableWithoutFeedback>
    );
}

RowContent.displayName = 'MoneyRequestReport.Table.RowContent';

export default RowContent;
