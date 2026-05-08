import type {ReactNode} from 'react';
import React, {useState} from 'react';
import type {ReceiptActions, ReceiptState} from './ReceiptContext';
import {ReceiptActionsContext, ReceiptStateContext} from './ReceiptContext';

type ReceiptContextProviderProps = {
    /** Subtree that reads/writes receipt state via `useReceipt()` / `useReceiptActions()`. */
    children: ReactNode;
};

/**
 * Composes the receipt state and actions contexts in canonical order — state outer,
 * actions inner — so a setter-only consumer subscribed to `ReceiptActionsContext`
 * never re-renders when the state context's value changes.
 *
 * The actions object's reference is stable across renders by virtue of React Compiler
 * memoization; no hand-written `useMemo` is necessary.
 */
function ReceiptContextProvider({children}: ReceiptContextProviderProps) {
    const [receipt, setReceiptState] = useState<ReceiptState>(null);

    const actions: ReceiptActions = {
        setReceipt: (next: string | null) => setReceiptState(next),
    };

    return (
        <ReceiptStateContext.Provider value={receipt}>
            <ReceiptActionsContext.Provider value={actions}>{children}</ReceiptActionsContext.Provider>
        </ReceiptStateContext.Provider>
    );
}

ReceiptContextProvider.displayName = 'ReceiptContextProvider';

export default ReceiptContextProvider;
