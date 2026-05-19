import {renderHook} from '@testing-library/react-native';
import React from 'react';
import ViolationsProvider, {useAllViolations, useFieldViolationMessages, useHasFieldViolation} from '@components/MoneyRequestView/contexts/ViolationsProvider';
import useOnyx from '@hooks/useOnyx';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {TransactionViolation} from '@src/types/onyx';

jest.mock('@hooks/useOnyx', () => jest.fn());
const mockUseOnyx = useOnyx as jest.MockedFunction<typeof useOnyx>;

const TRANSACTION_ID = 'txn-1';

function setupViolations(violations: TransactionViolation[] | undefined) {
    mockUseOnyx.mockImplementation(((key: string) => {
        if (key === `${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${TRANSACTION_ID}`) {
            return [violations, {status: 'loaded'}];
        }
        return [undefined, {status: 'loaded'}];
    }) as typeof useOnyx);
}

function wrap({shouldShowOnlyViolations = false}: {shouldShowOnlyViolations?: boolean} = {}) {
    function Wrapper({children}: {children: React.ReactNode}) {
        return (
            <ViolationsProvider
                transactionID={TRANSACTION_ID}
                shouldShowOnlyViolations={shouldShowOnlyViolations}
            >
                {children}
            </ViolationsProvider>
        );
    }
    return Wrapper;
}

describe('ViolationsProvider', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('throws when useHasFieldViolation called outside provider', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => renderHook(() => useHasFieldViolation('amount'))).toThrow('ViolationsProvider missing');
        consoleError.mockRestore();
    });

    it('throws when useFieldViolationMessages called outside provider', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => renderHook(() => useFieldViolationMessages('amount'))).toThrow('ViolationsProvider missing');
        consoleError.mockRestore();
    });

    it('throws when useAllViolations called outside provider', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => renderHook(() => useAllViolations())).toThrow('ViolationsProvider missing');
        consoleError.mockRestore();
    });

    it('returns true scalar and narrow array for a field with a violation', () => {
        const amountViolation: TransactionViolation = {
            name: CONST.VIOLATIONS.OVER_LIMIT,
            type: CONST.VIOLATION_TYPES.VIOLATION,
        } as TransactionViolation;
        const merchantViolation: TransactionViolation = {
            name: CONST.VIOLATIONS.RTER,
            type: CONST.VIOLATION_TYPES.VIOLATION,
        } as TransactionViolation;

        setupViolations([amountViolation, merchantViolation]);

        const {result} = renderHook(
            () => ({
                hasAmount: useHasFieldViolation('amount'),
                amountMessages: useFieldViolationMessages('amount'),
                all: useAllViolations(),
            }),
            {wrapper: wrap()},
        );

        expect(result.current.hasAmount).toBe(true);
        expect(typeof result.current.hasAmount).toBe('boolean');
        expect(result.current.amountMessages).toHaveLength(1);
        expect(result.current.amountMessages.at(0)?.name).toBe(CONST.VIOLATIONS.OVER_LIMIT);
        expect(result.current.all).toHaveLength(2);
    });

    it('returns false scalar and empty narrow array for a field with no violations', () => {
        const amountViolation: TransactionViolation = {
            name: CONST.VIOLATIONS.OVER_LIMIT,
            type: CONST.VIOLATION_TYPES.VIOLATION,
        } as TransactionViolation;

        setupViolations([amountViolation]);

        const {result} = renderHook(
            () => ({
                hasMerchant: useHasFieldViolation('merchant'),
                merchantMessages: useFieldViolationMessages('merchant'),
            }),
            {wrapper: wrap()},
        );

        expect(result.current.hasMerchant).toBe(false);
        expect(result.current.merchantMessages).toEqual([]);
    });

    it('preserves scalar / narrow / full split (full includes everything, narrow only that field)', () => {
        const amountViolation: TransactionViolation = {
            name: CONST.VIOLATIONS.OVER_LIMIT,
            type: CONST.VIOLATION_TYPES.VIOLATION,
        } as TransactionViolation;
        const categoryViolation: TransactionViolation = {
            name: CONST.VIOLATIONS.CATEGORY_OUT_OF_POLICY,
            type: CONST.VIOLATION_TYPES.VIOLATION,
        } as TransactionViolation;
        const receiptViolation: TransactionViolation = {
            name: CONST.VIOLATIONS.RECEIPT_REQUIRED,
            type: CONST.VIOLATION_TYPES.VIOLATION,
        } as TransactionViolation;

        setupViolations([amountViolation, categoryViolation, receiptViolation]);

        const {result} = renderHook(
            () => ({
                hasAmount: useHasFieldViolation('amount'),
                amountMessages: useFieldViolationMessages('amount'),
                categoryMessages: useFieldViolationMessages('category'),
                all: useAllViolations(),
            }),
            {wrapper: wrap()},
        );

        expect(result.current.hasAmount).toBe(true);
        expect(result.current.amountMessages).toHaveLength(1);
        expect(result.current.categoryMessages).toHaveLength(1);
        expect(result.current.all).toHaveLength(3);
    });

    it('applies useViolations field-mapping rules (overLimit -> amount, rter -> merchant)', () => {
        const overLimit: TransactionViolation = {
            name: CONST.VIOLATIONS.OVER_LIMIT,
            type: CONST.VIOLATION_TYPES.VIOLATION,
        } as TransactionViolation;
        const rter: TransactionViolation = {
            name: CONST.VIOLATIONS.RTER,
            type: CONST.VIOLATION_TYPES.VIOLATION,
        } as TransactionViolation;

        setupViolations([overLimit, rter]);

        const {result} = renderHook(
            () => ({
                amount: useFieldViolationMessages('amount'),
                merchant: useFieldViolationMessages('merchant'),
                receipt: useFieldViolationMessages('receipt'),
            }),
            {wrapper: wrap()},
        );

        expect(result.current.amount.at(0)?.name).toBe(CONST.VIOLATIONS.OVER_LIMIT);
        expect(result.current.merchant.at(0)?.name).toBe(CONST.VIOLATIONS.RTER);
        expect(result.current.receipt).toEqual([]);
    });

    it('filters out non-violation types when shouldShowOnlyViolations=true', () => {
        const violation: TransactionViolation = {
            name: CONST.VIOLATIONS.OVER_LIMIT,
            type: CONST.VIOLATION_TYPES.VIOLATION,
        } as TransactionViolation;
        const notice: TransactionViolation = {
            name: CONST.VIOLATIONS.MODIFIED_AMOUNT,
            type: CONST.VIOLATION_TYPES.NOTICE,
        } as TransactionViolation;

        setupViolations([violation, notice]);

        const {result} = renderHook(
            () => ({
                amount: useFieldViolationMessages('amount'),
            }),
            {wrapper: wrap({shouldShowOnlyViolations: true})},
        );

        expect(result.current.amount).toHaveLength(1);
        expect(result.current.amount.at(0)?.type).toBe(CONST.VIOLATION_TYPES.VIOLATION);
    });

    it('returns empty arrays when there are no violations', () => {
        setupViolations(undefined);

        const {result} = renderHook(
            () => ({
                hasAmount: useHasFieldViolation('amount'),
                amountMessages: useFieldViolationMessages('amount'),
                all: useAllViolations(),
            }),
            {wrapper: wrap()},
        );

        expect(result.current.hasAmount).toBe(false);
        expect(result.current.amountMessages).toEqual([]);
        expect(result.current.all).toEqual([]);
    });
});
