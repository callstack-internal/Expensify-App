import {createContext, useContext} from 'react';

/**
 * Reply target — the action a user tapped "reply" on plus the preview line the
 * composer renders above the input. The composer reads the value via `useReply()`
 * and displays the preview; `Actions` calls `useReplyActions().setReply(...)` when
 * the user taps reply on a row.
 *
 * Separate instance from `TransactionThread/ReplyContextProvider` — same shape, but
 * the chat-report subtree must not subscribe to a transaction-thread provider mounted
 * elsewhere. CLEAN-REACT-PATTERNS-3: each compound owns its state surface.
 */
type Reply = {
    reportActionID: string;
    previewText: string;
};

// Warm — changes when the user taps reply on a row, otherwise stable.
type ReplyState = Reply | null;

// Frozen — stable reference for the lifetime of the provider.
type ReplyActions = {
    setReply: (reply: Reply) => void;
};

const noop = () => {};

const ReplyStateContext = createContext<ReplyState>(null);

const defaultActions: ReplyActions = {
    setReply: noop,
};
const ReplyActionsContext = createContext<ReplyActions>(defaultActions);

/**
 * Read the current reply target, or `null` when nothing is being replied to.
 * Returns the value directly (no `{target: ...}` wrapper) so consumers can compose
 * naturally with the rest of their render. Outside the provider, defaults to `null`.
 */
function useReply(): ReplyState {
    return useContext(ReplyStateContext);
}

/**
 * Read the actions object — stable across reply-state changes so a setter-only
 * consumer never re-renders on state churn (verified by the render-counter spy in
 * tests). Outside the provider, defaults to a no-op object so consumers don't have
 * to null-check.
 */
function useReplyActions(): ReplyActions {
    return useContext(ReplyActionsContext);
}

export {ReplyStateContext, ReplyActionsContext, useReply, useReplyActions};
export type {Reply, ReplyState, ReplyActions};
