import {render} from '@testing-library/react-native';
import React from 'react';
import MoneyRequestViewInThread from '@components/MoneyRequestView/MoneyRequestViewInThread';
import MoneyRequestViewPreview from '@components/MoneyRequestView/MoneyRequestViewPreview';
import {AmountRow, AmountRowSnapshot} from '@components/MoneyRequestView/rows/AmountRow';
import useOnyx from '@hooks/useOnyx';
import useReportIsArchived from '@hooks/useReportIsArchived';
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

jest.mock('@hooks/useCurrencyList', () => ({
    useCurrencyListActions: () => ({
        convertToDisplayString: (amount: number | undefined, currency: string | undefined) => {
            if (amount === undefined) {
                return '';
            }
            const symbol = currency === 'USD' ? '$' : (currency ?? '');
            return `${symbol}${(amount / 100).toFixed(2)}`;
        },
        getCurrencySymbol: () => '$',
    }),
}));

jest.mock('@hooks/useCurrentUserPersonalDetails', () =>
    jest.fn(() => ({
        accountID: 1,
        login: 'test@example.com',
    })),
);

jest.mock('@hooks/useReportTransactions', () => jest.fn(() => []));
jest.mock('@hooks/useHasMultipleSplitChildren', () => jest.fn(() => false));
jest.mock('@hooks/useActiveRoute', () => jest.fn(() => ({getReportRHPActiveRoute: () => ''})));
jest.mock('@hooks/useLazyAsset', () => ({
    useMemoizedLazyExpensifyIcons: () => ({Checkmark: () => null}),
}));

jest.mock('@libs/Navigation/Navigation', () => ({
    navigate: jest.fn(),
}));

jest.mock('@libs/actions/SplitExpenses', () => jest.fn());

jest.mock('@components/MenuItemWithTopDescription', () => {
    const {Text} = jest.requireActual('react-native');
    return function MenuItemWithTopDescriptionStub({title, description}: {title?: string; description?: string}) {
        return (
            <>
                {title ? <Text>{title}</Text> : null}
                {description ? <Text>{description}</Text> : null}
            </>
        );
    };
});

const TRANSACTION_ID = 'txn-1';
const PARENT_REPORT_ID = 'parent-1';
const POLICY_ID = 'policy-1';

const TX = {
    transactionID: TRANSACTION_ID,
    amount: 12345,
    currency: 'USD',
    reportID: PARENT_REPORT_ID,
} as unknown as Transaction;

function setupOnyx(overrides: Record<string, unknown>) {
    mockUseOnyx.mockImplementation(((key: string, options?: {selector?: (data: unknown) => unknown}) => {
        const raw = key in overrides ? overrides[key] : undefined;
        const value = options?.selector ? options.selector(raw) : raw;
        return [value, {status: 'loaded'}];
    }) as typeof useOnyx);
}

describe('AmountRow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseReportIsArchived.mockReturnValue(false);
        setupOnyx({[`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: TX});
    });

    it('renders the formatted amount inside MoneyRequestViewInThread', () => {
        const {getByText} = render(
            <MoneyRequestViewInThread
                transactionID={TRANSACTION_ID}
                parentReportID={PARENT_REPORT_ID}
                policyID={POLICY_ID}
            >
                <AmountRow />
            </MoneyRequestViewInThread>,
        );
        expect(getByText('$123.45')).toBeTruthy();
    });

    it('AmountRowSnapshot renders the formatted amount inside MoneyRequestViewPreview', () => {
        const {getByText} = render(
            <MoneyRequestViewPreview
                source={TX}
                policyID={POLICY_ID}
            >
                <AmountRowSnapshot />
            </MoneyRequestViewPreview>,
        );
        expect(getByText('$123.45')).toBeTruthy();
    });

    it('AmountRow inside MoneyRequestViewPreview throws context-missing', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() =>
            render(
                <MoneyRequestViewPreview
                    source={TX}
                    policyID={POLICY_ID}
                >
                    <AmountRow />
                </MoneyRequestViewPreview>,
            ),
        ).toThrow('LiveTransactionProvider missing');
        consoleError.mockRestore();
    });

    it('AmountRowSnapshot inside MoneyRequestViewInThread throws context-missing', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() =>
            render(
                <MoneyRequestViewInThread
                    transactionID={TRANSACTION_ID}
                    parentReportID={PARENT_REPORT_ID}
                    policyID={POLICY_ID}
                >
                    <AmountRowSnapshot />
                </MoneyRequestViewInThread>,
            ),
        ).toThrow('SnapshotTransactionProvider missing');
        consoleError.mockRestore();
    });
});
