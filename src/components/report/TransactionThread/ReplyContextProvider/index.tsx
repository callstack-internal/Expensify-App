import type {ReactNode} from 'react';
import React, {useState} from 'react';
import type {Reply, ReplyActions, ReplyState} from './ReplyContext';
import {ReplyActionsContext, ReplyStateContext} from './ReplyContext';

type ReplyContextProviderProps = {
    /** Subtree that reads/writes reply state via `useReply()` / `useReplyActions()`. */
    children: ReactNode;
};

/**
 * Composes the reply state and actions contexts in canonical order — state outer,
 * actions inner — so a setter-only consumer subscribed to `ReplyActionsContext`
 * never re-renders when the state context's value changes.
 *
 * The actions object's reference is stable across renders by virtue of React Compiler
 * memoization; no hand-written `useMemo` is necessary.
 */
function ReplyContextProvider({children}: ReplyContextProviderProps) {
    const [reply, setReplyState] = useState<ReplyState>(null);

    const actions: ReplyActions = {
        setReply: (next: Reply) => setReplyState(next),
    };

    return (
        <ReplyStateContext.Provider value={reply}>
            <ReplyActionsContext.Provider value={actions}>{children}</ReplyActionsContext.Provider>
        </ReplyStateContext.Provider>
    );
}

ReplyContextProvider.displayName = 'ReplyContextProvider';

export default ReplyContextProvider;
