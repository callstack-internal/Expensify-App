import {createContext, useContext} from 'react';

/**
 * Receipt target — the transaction id whose receipt is currently being viewed in the
 * `ReceiptPanel`. The panel reads the value via `useReceipt()` and renders that
 * transaction's receipt; row frames call `useReceiptActions().setReceipt(...)` when
 * the user taps a row.
 *
 * The state context holds the id directly (no `{target: ...}` wrapper) so consumers
 * can compose naturally. Mirrors the shape of `TransactionThread.ReplyContextProvider`.
 */

// Warm — changes when the user taps a different row, otherwise stable.
type ReceiptState = string | null;

// Frozen — stable reference for the lifetime of the provider.
type ReceiptActions = {
    setReceipt: (id: string | null) => void;
};

const noop = () => {};

const ReceiptStateContext = createContext<ReceiptState>(null);

const defaultActions: ReceiptActions = {
    setReceipt: noop,
};
const ReceiptActionsContext = createContext<ReceiptActions>(defaultActions);

/**
 * Read the current receipt-target transaction id, or `null` when nothing is being
 * viewed. Returns the value directly (no wrapper). Outside the provider, defaults
 * to `null`.
 */
function useReceipt(): ReceiptState {
    return useContext(ReceiptStateContext);
}

/**
 * Read the actions object — stable across receipt-state changes so a setter-only
 * consumer never re-renders on state churn (verified by the render-counter spy in
 * tests). Outside the provider, defaults to a no-op object so consumers don't have
 * to null-check.
 */
function useReceiptActions(): ReceiptActions {
    return useContext(ReceiptActionsContext);
}

export {ReceiptStateContext, ReceiptActionsContext, useReceipt, useReceiptActions};
export type {ReceiptState, ReceiptActions};
