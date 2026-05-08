import React from 'react';
import type {LayoutChangeEvent} from 'react-native';
import MoneyRequestReportActionsList from '@components/MoneyRequestReportView/MoneyRequestReportActionsList';

type TableProps = {
    /**
     * Identity of the multi-transaction money-request report. The wrapped
     * `MoneyRequestReportActionsList` resolves the same id from `useRoute()` itself
     * today; the prop is held on the block contract so a follow-up that pushes
     * `reportID` through props can flip the wrapper to forward it.
     */
    reportID: string | undefined;

    /** Layout callback forwarded to the actions list (used for telemetry timing). */
    onLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * Multi-transaction money-request table block. Thin wrapper around today's
 * `MoneyRequestReportActionsList` so the visible behavior is unchanged while the
 * compound architecture takes ownership of the surrounding shell.
 *
 * Per the compound-row pattern, this block does NOT subscribe to receipt-target
 * or selection state; the per-row `RowHighlightFrame` / `RowSelectionFrame` blocks
 * own those subscriptions so a re-render here cannot cascade into row content.
 *
 * The `reportID` prop is forwarded for forward-compat — today's list resolves both
 * `reportID` and `reportActionID` from `useRoute()` internally; a follow-up making
 * the list accept them as props will flip this wrapper to forward them.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- See block comment above.
function Table({reportID, onLayout}: TableProps) {
    return <MoneyRequestReportActionsList onLayout={onLayout} />;
}

Table.displayName = 'MoneyRequestReport.Table';

export default Table;
