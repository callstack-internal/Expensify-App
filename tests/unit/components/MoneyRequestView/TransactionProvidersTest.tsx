import {renderHook} from '@testing-library/react-native';
import React from 'react';
import LiveTransactionProvider, {useLiveTransactionField} from '@components/MoneyRequestView/contexts/LiveTransactionProvider';
import SnapshotTransactionProvider, {useSnapshotTransactionField} from '@components/MoneyRequestView/contexts/SnapshotTransactionProvider';
import {useTransactionPolicyID} from '@components/MoneyRequestView/contexts/TransactionPolicyContext';
import useOnyx from '@hooks/useOnyx';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Transaction} from '@src/types/onyx';

jest.mock('@hooks/useOnyx', () => jest.fn());
const mockUseOnyx = useOnyx as jest.MockedFunction<typeof useOnyx>;

const TRANSACTION_ID = 'txn-1';
const POLICY_ID = 'policy-1';

const TX = {
    transactionID: TRANSACTION_ID,
    amount: 1234,
    currency: 'USD',
    merchant: 'Acme',
    comment: {comment: 'Lunch'},
} as unknown as Transaction;

function setupOnyx(tx: Transaction | undefined) {
    mockUseOnyx.mockImplementation(((key: string, options?: {selector?: (data: unknown) => unknown}) => {
        if (key === `${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`) {
            const value = options?.selector ? options.selector(tx) : tx;
            return [value, {status: 'loaded'}];
        }
        return [undefined, {status: 'loaded'}];
    }) as typeof useOnyx);
}

function wrapLive() {
    function Wrapper({children}: {children: React.ReactNode}) {
        return (
            <LiveTransactionProvider
                transactionID={TRANSACTION_ID}
                policyID={POLICY_ID}
            >
                {children}
            </LiveTransactionProvider>
        );
    }
    return Wrapper;
}

function wrapSnapshot(source: Transaction = TX) {
    function Wrapper({children}: {children: React.ReactNode}) {
        return (
            <SnapshotTransactionProvider
                source={source}
                policyID={POLICY_ID}
            >
                {children}
            </SnapshotTransactionProvider>
        );
    }
    return Wrapper;
}

describe('LiveTransactionProvider / SnapshotTransactionProvider', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('useLiveTransactionField inside SnapshotTransactionProvider throws', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() =>
            renderHook(() => useLiveTransactionField((t) => t.amount), {
                wrapper: wrapSnapshot(),
            }),
        ).toThrow('LiveTransactionProvider missing');
        consoleError.mockRestore();
    });

    it('useSnapshotTransactionField inside LiveTransactionProvider throws', () => {
        setupOnyx(TX);
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() =>
            renderHook(() => useSnapshotTransactionField((t) => t.amount), {
                wrapper: wrapLive(),
            }),
        ).toThrow('SnapshotTransactionProvider missing');
        consoleError.mockRestore();
    });

    it('useTransactionPolicyID throws when called outside any provider', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => renderHook(() => useTransactionPolicyID())).toThrow('TransactionPolicyContext missing');
        consoleError.mockRestore();
    });

    it('parity: same transaction shape + selector → same value in both providers', () => {
        setupOnyx(TX);

        const selectorAmount = (t: Transaction) => t.amount;
        const selectorMerchant = (t: Transaction) => t.merchant;

        const live = renderHook(
            () => ({
                amount: useLiveTransactionField(selectorAmount),
                merchant: useLiveTransactionField(selectorMerchant),
            }),
            {wrapper: wrapLive()},
        );

        const snap = renderHook(
            () => ({
                amount: useSnapshotTransactionField(selectorAmount),
                merchant: useSnapshotTransactionField(selectorMerchant),
            }),
            {wrapper: wrapSnapshot(TX)},
        );

        expect(live.result.current.amount).toBe(snap.result.current.amount);
        expect(live.result.current.merchant).toBe(snap.result.current.merchant);
        expect(live.result.current.amount).toBe(TX.amount);
        expect(live.result.current.merchant).toBe(TX.merchant);
    });

    it('useTransactionPolicyID returns configured ID under LiveTransactionProvider', () => {
        setupOnyx(TX);
        const {result} = renderHook(() => useTransactionPolicyID(), {wrapper: wrapLive()});
        expect(result.current).toBe(POLICY_ID);
    });

    it('useTransactionPolicyID returns configured ID under SnapshotTransactionProvider', () => {
        const {result} = renderHook(() => useTransactionPolicyID(), {wrapper: wrapSnapshot()});
        expect(result.current).toBe(POLICY_ID);
    });

    it('live field hook narrows via selector — returns selector output', () => {
        setupOnyx(TX);
        const {result} = renderHook(() => useLiveTransactionField((t) => t.currency), {wrapper: wrapLive()});
        expect(result.current).toBe('USD');
    });

    it('snapshot field hook applies selector to source', () => {
        const {result} = renderHook(() => useSnapshotTransactionField((t) => t.comment?.comment), {wrapper: wrapSnapshot()});
        expect(result.current).toBe('Lunch');
    });
});
