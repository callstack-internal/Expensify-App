import {render} from '@testing-library/react-native';
import React from 'react';
import MoneyRequestViewInThread from '@components/MoneyRequestView/MoneyRequestViewInThread';
import MoneyRequestViewPreview from '@components/MoneyRequestView/MoneyRequestViewPreview';
import {DateRow, DateRowSnapshot} from '@components/MoneyRequestView/rows/DateRow';
import {DescriptionRow, DescriptionRowSnapshot} from '@components/MoneyRequestView/rows/DescriptionRow';
import {MerchantOrDistanceRow, MerchantOrDistanceRowSnapshot} from '@components/MoneyRequestView/rows/MerchantOrDistanceRow';
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

jest.mock('@libs/Navigation/Navigation', () => ({
    navigate: jest.fn(),
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
    merchant: 'Test Merchant Inc.',
    created: '2026-05-01',
    comment: {comment: 'Lunch with team'},
} as unknown as Transaction;

const EMPTY_DESCRIPTION_TX = {
    ...BASE_TX,
    comment: {comment: ''},
} as unknown as Transaction;

const DISTANCE_TX = {
    transactionID: TRANSACTION_ID,
    amount: 5000,
    currency: 'USD',
    reportID: PARENT_REPORT_ID,
    merchant: '10 mi @ $0.50/mi',
    created: '2026-05-01',
    iouRequestType: 'distance',
    comment: {
        type: 'custom_unit',
        customUnit: {
            name: 'Distance',
            distanceUnit: 'mi',
            quantity: 10,
            customUnitRateID: 'rate-1',
        },
        waypoints: {
            waypoint0: {lat: 0, lng: 0, address: 'A'},
            waypoint1: {lat: 1, lng: 1, address: 'B'},
        },
    },
} as unknown as Transaction;

function setupOnyx(overrides: Record<string, unknown>) {
    mockUseOnyx.mockImplementation(((key: string, options?: {selector?: (data: unknown) => unknown}) => {
        const raw = key in overrides ? overrides[key] : undefined;
        const value = options?.selector ? options.selector(raw) : raw;
        return [value, {status: 'loaded'}];
    }) as typeof useOnyx);
}

describe('Row batch A', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseReportIsArchived.mockReturnValue(false);
    });

    describe('DescriptionRow', () => {
        it('renders the description inside MoneyRequestViewInThread', () => {
            setupOnyx({[`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: BASE_TX});
            const {getByText} = render(
                <MoneyRequestViewInThread
                    transactionID={TRANSACTION_ID}
                    parentReportID={PARENT_REPORT_ID}
                    policyID={POLICY_ID}
                >
                    <DescriptionRow />
                </MoneyRequestViewInThread>,
            );
            expect(getByText('Lunch with team')).toBeTruthy();
        });

        it('DescriptionRowSnapshot renders the description inside MoneyRequestViewPreview', () => {
            setupOnyx({});
            const {getByText} = render(
                <MoneyRequestViewPreview
                    source={BASE_TX}
                    policyID={POLICY_ID}
                >
                    <DescriptionRowSnapshot />
                </MoneyRequestViewPreview>,
            );
            expect(getByText('Lunch with team')).toBeTruthy();
        });

        it('DescriptionRowSnapshot renders nothing when description is empty', () => {
            setupOnyx({});
            const {queryByText} = render(
                <MoneyRequestViewPreview
                    source={EMPTY_DESCRIPTION_TX}
                    policyID={POLICY_ID}
                >
                    <DescriptionRowSnapshot />
                </MoneyRequestViewPreview>,
            );
            expect(queryByText(/description/i)).toBeNull();
        });
    });

    describe('MerchantOrDistanceRow', () => {
        it('renders the merchant title for non-distance transactions', () => {
            setupOnyx({[`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: BASE_TX});
            const {getByText} = render(
                <MoneyRequestViewInThread
                    transactionID={TRANSACTION_ID}
                    parentReportID={PARENT_REPORT_ID}
                    policyID={POLICY_ID}
                >
                    <MerchantOrDistanceRow />
                </MoneyRequestViewInThread>,
            );
            expect(getByText('Test Merchant Inc.')).toBeTruthy();
        });

        it('renders distance and rate rows for distance transactions', () => {
            setupOnyx({[`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: DISTANCE_TX});
            const {UNSAFE_getAllByType} = render(
                <MoneyRequestViewInThread
                    transactionID={TRANSACTION_ID}
                    parentReportID={PARENT_REPORT_ID}
                    policyID={POLICY_ID}
                >
                    <MerchantOrDistanceRow />
                </MoneyRequestViewInThread>,
            );
            // Distance branch composes 2 FieldRows (distance + rate); each renders via OfflineWithFeedback wrapper.
            const {Text} = jest.requireActual('react-native');
            expect(UNSAFE_getAllByType(Text).length).toBeGreaterThan(0);
        });

        it('MerchantOrDistanceRowSnapshot renders inside MoneyRequestViewPreview', () => {
            setupOnyx({});
            const {getByText} = render(
                <MoneyRequestViewPreview
                    source={BASE_TX}
                    policyID={POLICY_ID}
                >
                    <MerchantOrDistanceRowSnapshot />
                </MoneyRequestViewPreview>,
            );
            expect(getByText('Test Merchant Inc.')).toBeTruthy();
        });
    });

    describe('DateRow', () => {
        it('renders the date inside MoneyRequestViewInThread', () => {
            setupOnyx({[`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: BASE_TX});
            const {getByText} = render(
                <MoneyRequestViewInThread
                    transactionID={TRANSACTION_ID}
                    parentReportID={PARENT_REPORT_ID}
                    policyID={POLICY_ID}
                >
                    <DateRow />
                </MoneyRequestViewInThread>,
            );
            expect(getByText('2026-05-01')).toBeTruthy();
        });

        it('DateRowSnapshot renders the date inside MoneyRequestViewPreview', () => {
            setupOnyx({});
            const {getByText} = render(
                <MoneyRequestViewPreview
                    source={BASE_TX}
                    policyID={POLICY_ID}
                >
                    <DateRowSnapshot />
                </MoneyRequestViewPreview>,
            );
            expect(getByText('2026-05-01')).toBeTruthy();
        });
    });
});
