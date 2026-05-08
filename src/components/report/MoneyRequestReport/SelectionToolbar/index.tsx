import React from 'react';
import {View} from 'react-native';
import {useSearchStateContext} from '@components/Search/SearchContext';

type SelectionToolbarProps = {
    /** Identity of the multi-transaction money-request report whose selection this toolbar acts on. */
    reportID: string | undefined;
};

/**
 * Selection toolbar gate for `MoneyRequestReport`. Self-subscribes to the
 * tree-wide `SearchContext.selectedTransactionIDs` and returns `null` when nothing
 * is selected, so blocks downstream pay no render cost when the toolbar is dormant.
 *
 * Today's full toolbar UI (inside `MoneyRequestReportActionsList`) renders only on
 * narrow layouts via `useMobileSelectionMode`; the multi-row selection bar at the
 * top of the desktop layout is owned by `MoneyReportHeaderActions` (mounted via
 * `MoneyRequestReport.Header`'s `MoneyReportHeader`). This block claims the
 * namespace slot for the upcoming extraction; it returns `null` when the selection
 * set is empty (per spec) and exposes a stable mount point that subscribes to
 * `selectedTransactionIDs` so render-counter spies can verify the render-isolation
 * contract end-to-end.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- See block comment above.
function SelectionToolbar({reportID}: SelectionToolbarProps) {
    const {selectedTransactionIDs} = useSearchStateContext();

    if (selectedTransactionIDs.length === 0) {
        return null;
    }

    return <View testID="MoneyRequestReport.SelectionToolbar" />;
}

SelectionToolbar.displayName = 'MoneyRequestReport.SelectionToolbar';

export default SelectionToolbar;
