import {render, screen} from '@testing-library/react-native';
import React from 'react';
import type ReactNativeModule from 'react-native';
import MoneyRequestViewPreview from '@components/MoneyRequestView/MoneyRequestViewPreview';
import MergeAmountSummary from '@components/MoneyRequestView/rows/MergeAmountSummary';
import useOnyx from '@hooks/useOnyx';
import type {Transaction} from '@src/types/onyx';

jest.mock('@hooks/useOnyx', () => jest.fn());
const mockUseOnyx = useOnyx as jest.MockedFunction<typeof useOnyx>;

jest.mock('@hooks/useCurrencyList', () => ({
    useCurrencyListActions: () => ({
        convertToDisplayString: (amount: number | undefined, currency: string | undefined) => {
            if (amount === undefined) {
                return '';
            }
            const symbol = currency === 'USD' ? '$' : (currency ?? '');
            return amount < 0 ? `-${symbol}${(Math.abs(amount) / 100).toFixed(2)}` : `${symbol}${(amount / 100).toFixed(2)}`;
        },
        getCurrencySymbol: () => '$',
    }),
}));

jest.mock('@components/MenuItemWithTopDescription', () => {
    const ReactNative = jest.requireActual<typeof ReactNativeModule>('react-native');
    const {Text} = ReactNative;
    function MenuItemWithTopDescriptionStub({title, description}: {title?: string; description?: string}) {
        return (
            <>
                {title ? <Text>{title}</Text> : null}
                {description ? <Text>{description}</Text> : null}
            </>
        );
    }
    return MenuItemWithTopDescriptionStub;
});

const POLICY_ID = 'policy-1';

function setupOnyx(overrides: Record<string, unknown> = {}) {
    mockUseOnyx.mockImplementation(((key: string, options?: {selector?: (data: unknown) => unknown}) => {
        const raw = key in overrides ? overrides[key] : undefined;
        const value = options?.selector ? options.selector(raw) : raw;
        return [value, {status: 'loaded'}];
    }) as typeof useOnyx);
}

describe('MergeAmountSummary', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setupOnyx();
    });

    it('renders the merged amount as-is (positive)', () => {
        const tx = {transactionID: 't-1', amount: 12345, currency: 'USD'} as unknown as Transaction;
        render(
            <MoneyRequestViewPreview
                source={tx}
                policyID={POLICY_ID}
            >
                <MergeAmountSummary />
            </MoneyRequestViewPreview>,
        );
        expect(screen.getByText('$123.45')).toBeTruthy();
    });

    it('preserves negative sign (does not Math.abs)', () => {
        const tx = {transactionID: 't-2', amount: -5000, currency: 'USD'} as unknown as Transaction;
        render(
            <MoneyRequestViewPreview
                source={tx}
                policyID={POLICY_ID}
            >
                <MergeAmountSummary />
            </MoneyRequestViewPreview>,
        );
        expect(screen.getByText('-$50.00')).toBeTruthy();
    });

    it('throws when used outside MoneyRequestViewPreview', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => render(<MergeAmountSummary />)).toThrow('SnapshotTransactionProvider missing');
        consoleError.mockRestore();
    });
});
