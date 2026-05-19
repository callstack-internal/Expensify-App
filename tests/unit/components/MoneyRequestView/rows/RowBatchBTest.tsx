import {render} from '@testing-library/react-native';
import React from 'react';
import MoneyRequestViewInThread from '@components/MoneyRequestView/MoneyRequestViewInThread';
import MoneyRequestViewPreview from '@components/MoneyRequestView/MoneyRequestViewPreview';
import {CategoryRow, CategoryRowSnapshot} from '@components/MoneyRequestView/rows/CategoryRow';
import {TagRows, TagRowsSnapshot} from '@components/MoneyRequestView/rows/TagRows';
import {TaxRow, TaxRowSnapshot} from '@components/MoneyRequestView/rows/TaxRow';
import useOnyx from '@hooks/useOnyx';
import useReportIsArchived from '@hooks/useReportIsArchived';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Transaction} from '@src/types/onyx';

jest.mock('@hooks/useOnyx', () => jest.fn());
const mockUseOnyx = useOnyx as jest.MockedFunction<typeof useOnyx>;

jest.mock('@hooks/useReportIsArchived', () => jest.fn(() => false));
const mockUseReportIsArchived = useReportIsArchived as jest.MockedFunction<typeof useReportIsArchived>;

jest.mock('@hooks/useCurrentUserPersonalDetails', () =>
    jest.fn(() => ({
        accountID: 1,
        login: 'test@example.com',
        timezone: {selected: 'UTC'},
    })),
);

jest.mock('@hooks/useActiveRoute', () => jest.fn(() => ({getReportRHPActiveRoute: () => ''})));
jest.mock('@hooks/useNetwork', () => jest.fn(() => ({isOffline: false})));
jest.mock('@hooks/useCurrencyList', () => ({
    useCurrencyListActions: () => ({
        convertToDisplayString: (amount: number | undefined) => (amount === undefined ? '' : `$${(amount / 100).toFixed(2)}`),
        getCurrencySymbol: () => '$',
    }),
}));

jest.mock('@hooks/usePolicyForMovingExpenses', () =>
    jest.fn(() => ({
        policyForMovingExpensesID: 'policy-1',
        policyForMovingExpenses: {id: 'policy-1', type: 'corporate'},
        shouldSelectPolicy: false,
    })),
);

jest.mock('@libs/Navigation/Navigation', () => ({
    navigate: jest.fn(),
    getActiveRoute: () => '',
}));

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

const BASE_TX = {
    transactionID: TRANSACTION_ID,
    amount: 12345,
    currency: 'USD',
    reportID: PARENT_REPORT_ID,
    category: 'Travel',
    tag: 'Engineering:Web',
    taxName: 'Sales Tax',
    taxAmount: 500,
    taxCode: 'tax-1',
} as unknown as Transaction;

const POLICY = {
    id: POLICY_ID,
    type: 'corporate',
    tax: {trackingEnabled: true},
    taxRates: {
        name: 'Tax',
        taxes: {'tax-1': {name: 'Sales Tax', value: '10%'}},
    },
};

const POLICY_CATEGORIES = {
    Travel: {name: 'Travel', enabled: true},
    Meals: {name: 'Meals', enabled: true},
};

const POLICY_TAGS = {
    Department: {
        name: 'Department',
        orderWeight: 0,
        required: false,
        tags: {Engineering: {name: 'Engineering', enabled: true}},
    },
    Team: {
        name: 'Team',
        orderWeight: 1,
        required: false,
        tags: {Web: {name: 'Web', enabled: true}},
    },
};

const PARENT_REPORT = {
    reportID: PARENT_REPORT_ID,
    policyID: POLICY_ID,
    chatType: 'policyExpenseChat',
};

function setupOnyx(overrides: Record<string, unknown>) {
    mockUseOnyx.mockImplementation(((key: string, options?: {selector?: (data: unknown) => unknown}) => {
        const raw = key in overrides ? overrides[key] : undefined;
        const value = options?.selector ? options.selector(raw) : raw;
        return [value, {status: 'loaded'}];
    }) as typeof useOnyx);
}

describe('Row batch B', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseReportIsArchived.mockReturnValue(false);
    });

    describe('CategoryRow', () => {
        it('renders the category inside MoneyRequestViewInThread', () => {
            setupOnyx({
                [`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: BASE_TX,
                [`${ONYXKEYS.COLLECTION.REPORT}${PARENT_REPORT_ID}`]: PARENT_REPORT,
                [`${ONYXKEYS.COLLECTION.POLICY}${POLICY_ID}`]: POLICY,
                [`${ONYXKEYS.COLLECTION.POLICY_CATEGORIES}${POLICY_ID}`]: POLICY_CATEGORIES,
            });
            const {getByText} = render(
                <MoneyRequestViewInThread
                    transactionID={TRANSACTION_ID}
                    parentReportID={PARENT_REPORT_ID}
                    policyID={POLICY_ID}
                >
                    <CategoryRow />
                </MoneyRequestViewInThread>,
            );
            expect(getByText('Travel')).toBeTruthy();
        });

        it('CategoryRowSnapshot renders the category inside MoneyRequestViewPreview', () => {
            setupOnyx({});
            const {getByText} = render(
                <MoneyRequestViewPreview
                    source={BASE_TX}
                    policyID={POLICY_ID}
                >
                    <CategoryRowSnapshot />
                </MoneyRequestViewPreview>,
            );
            expect(getByText('Travel')).toBeTruthy();
        });
    });

    describe('TagRows', () => {
        it('renders tag rows inside MoneyRequestViewInThread', () => {
            setupOnyx({
                [`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: BASE_TX,
                [`${ONYXKEYS.COLLECTION.REPORT}${PARENT_REPORT_ID}`]: PARENT_REPORT,
                [`${ONYXKEYS.COLLECTION.POLICY}${POLICY_ID}`]: POLICY,
                [`${ONYXKEYS.COLLECTION.POLICY_TAGS}${POLICY_ID}`]: POLICY_TAGS,
            });
            const {getByText} = render(
                <MoneyRequestViewInThread
                    transactionID={TRANSACTION_ID}
                    parentReportID={PARENT_REPORT_ID}
                    policyID={POLICY_ID}
                >
                    <TagRows />
                </MoneyRequestViewInThread>,
            );
            expect(getByText('Engineering')).toBeTruthy();
            expect(getByText('Web')).toBeTruthy();
        });

        it('TagRowsSnapshot renders tag rows inside MoneyRequestViewPreview', () => {
            setupOnyx({[`${ONYXKEYS.COLLECTION.POLICY_TAGS}${POLICY_ID}`]: POLICY_TAGS});
            const {getByText} = render(
                <MoneyRequestViewPreview
                    source={BASE_TX}
                    policyID={POLICY_ID}
                >
                    <TagRowsSnapshot />
                </MoneyRequestViewPreview>,
            );
            expect(getByText('Engineering')).toBeTruthy();
            expect(getByText('Web')).toBeTruthy();
        });
    });

    describe('TaxRow', () => {
        it('renders tax rate and amount inside MoneyRequestViewInThread', () => {
            setupOnyx({
                [`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: BASE_TX,
                [`${ONYXKEYS.COLLECTION.REPORT}${PARENT_REPORT_ID}`]: PARENT_REPORT,
                [`${ONYXKEYS.COLLECTION.POLICY}${POLICY_ID}`]: POLICY,
            });
            const {getByText} = render(
                <MoneyRequestViewInThread
                    transactionID={TRANSACTION_ID}
                    parentReportID={PARENT_REPORT_ID}
                    policyID={POLICY_ID}
                >
                    <TaxRow />
                </MoneyRequestViewInThread>,
            );
            expect(getByText('Sales Tax')).toBeTruthy();
            expect(getByText('$5.00')).toBeTruthy();
        });

        it('TaxRowSnapshot renders tax details inside MoneyRequestViewPreview', () => {
            setupOnyx({});
            const {getByText} = render(
                <MoneyRequestViewPreview
                    source={BASE_TX}
                    policyID={POLICY_ID}
                >
                    <TaxRowSnapshot />
                </MoneyRequestViewPreview>,
            );
            expect(getByText('Sales Tax')).toBeTruthy();
        });
    });
});
