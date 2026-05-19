import React, {createContext, useContext} from 'react';
import useOnyx from '@hooks/useOnyx';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Transaction} from '@src/types/onyx';
import TransactionPolicyProvider from './TransactionPolicyContext';

type LiveTransactionContextValue = {
    transactionID: string;
};

const LiveTransactionContext = createContext<LiveTransactionContextValue | null>(null);

type LiveTransactionProviderProps = {
    transactionID: string;
    policyID: string;
    children: React.ReactNode;
};

function LiveTransactionProvider({transactionID, policyID, children}: LiveTransactionProviderProps) {
    const value: LiveTransactionContextValue = {transactionID};
    return (
        <LiveTransactionContext.Provider value={value}>
            <TransactionPolicyProvider policyID={policyID}>{children}</TransactionPolicyProvider>
        </LiveTransactionContext.Provider>
    );
}

function useLiveTransactionContext(): LiveTransactionContextValue {
    const ctx = useContext(LiveTransactionContext);
    if (!ctx) {
        throw new Error('LiveTransactionProvider missing');
    }
    return ctx;
}

function useLiveTransactionField<T>(selector: (tx: Transaction) => T): T {
    const {transactionID} = useLiveTransactionContext();
    const [value] = useOnyx(`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`, {
        selector: (tx) => selector(tx as Transaction),
    });
    return value as T;
}

export default LiveTransactionProvider;
export {useLiveTransactionField};
