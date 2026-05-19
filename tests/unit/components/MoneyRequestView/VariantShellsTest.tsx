import {renderHook} from '@testing-library/react-native';
import React from 'react';
import {useLiveTransactionField} from '@components/MoneyRequestView/contexts/LiveTransactionProvider';
import {useSnapshotTransactionField} from '@components/MoneyRequestView/contexts/SnapshotTransactionProvider';
import {useFieldEditPermission} from '@components/MoneyRequestView/contexts/ThreadProvider';
import {useTransactionPolicyID} from '@components/MoneyRequestView/contexts/TransactionPolicyContext';
import MoneyRequestViewInThread from '@components/MoneyRequestView/MoneyRequestViewInThread';
import MoneyRequestViewPreview from '@components/MoneyRequestView/MoneyRequestViewPreview';
import useOnyx from '@hooks/useOnyx';
import useReportIsArchived from '@hooks/useReportIsArchived';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Transaction} from '@src/types/onyx';

jest.mock('@hooks/useOnyx', () => jest.fn());
const mockUseOnyx = useOnyx as jest.MockedFunction<typeof useOnyx>;

jest.mock('@hooks/useReportIsArchived', () => jest.fn(() => false));
const mockUseReportIsArchived = useReportIsArchived as jest.MockedFunction<typeof useReportIsArchived>;

jest.mock('@components/Search/SearchContext', () => ({
    useSearchStateContext: () => ({currentSearchResults: undefined}),
    SearchStateContext: {Provider: ({children}: {children: React.ReactNode}) => children},
}));

const TRANSACTION_ID = 'txn-1';
const PARENT_REPORT_ID = 'parent-1';
const POLICY_ID = 'policy-1';

const TX = {
    transactionID: TRANSACTION_ID,
    amount: 5000,
    currency: 'USD',
} as unknown as Transaction;

function setupOnyx(overrides: Record<string, unknown>) {
    mockUseOnyx.mockImplementation(((key: string, options?: {selector?: (data: unknown) => unknown}) => {
        const raw = key in overrides ? overrides[key] : undefined;
        const value = options?.selector ? options.selector(raw) : raw;
        return [value, {status: 'loaded'}];
    }) as typeof useOnyx);
}

function wrapInThread() {
    function Wrapper({children}: {children: React.ReactNode}) {
        return (
            <MoneyRequestViewInThread
                transactionID={TRANSACTION_ID}
                parentReportID={PARENT_REPORT_ID}
                policyID={POLICY_ID}
            >
                {children}
            </MoneyRequestViewInThread>
        );
    }
    return Wrapper;
}

function wrapPreview() {
    function Wrapper({children}: {children: React.ReactNode}) {
        return (
            <MoneyRequestViewPreview
                source={TX}
                policyID={POLICY_ID}
            >
                {children}
            </MoneyRequestViewPreview>
        );
    }
    return Wrapper;
}

describe('Variant shells', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseReportIsArchived.mockReturnValue(false);
        setupOnyx({[`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: TX});
    });

    it('MoneyRequestViewInThread mounts all three providers', () => {
        const {result} = renderHook(
            () => ({
                amountEditable: useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.AMOUNT),
                policyID: useTransactionPolicyID(),
            }),
            {wrapper: wrapInThread()},
        );
        expect(typeof result.current.amountEditable).toBe('boolean');
        expect(result.current.policyID).toBe(POLICY_ID);
    });

    it('MoneyRequestViewPreview mounts snapshot + policy providers', () => {
        const {result} = renderHook(
            () => ({
                policyID: useTransactionPolicyID(),
                amount: useSnapshotTransactionField((tx) => tx.amount),
            }),
            {wrapper: wrapPreview()},
        );
        expect(result.current.policyID).toBe(POLICY_ID);
        expect(result.current.amount).toBe(TX.amount);
    });

    it('useSnapshotTransactionField inside MoneyRequestViewInThread throws', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => renderHook(() => useSnapshotTransactionField((tx) => tx.amount), {wrapper: wrapInThread()})).toThrow('SnapshotTransactionProvider missing');
        consoleError.mockRestore();
    });

    it('useLiveTransactionField inside MoneyRequestViewPreview throws', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => renderHook(() => useLiveTransactionField((tx) => tx.amount), {wrapper: wrapPreview()})).toThrow('LiveTransactionProvider missing');
        consoleError.mockRestore();
    });
});
