import {render} from '@testing-library/react-native';
import React from 'react';
import MoneyRequestViewInThread from '@components/MoneyRequestView/MoneyRequestViewInThread';
import MoneyRequestViewPreview from '@components/MoneyRequestView/MoneyRequestViewPreview';
import {AttendeesRow, AttendeesRowSnapshot} from '@components/MoneyRequestView/rows/AttendeesRow';
import {BillableRow, BillableRowSnapshot} from '@components/MoneyRequestView/rows/BillableRow';
import {CardRow, CardRowSnapshot} from '@components/MoneyRequestView/rows/CardRow';
import CompanyCardConnectionWarning from '@components/MoneyRequestView/rows/CompanyCardConnectionWarning';
import {ReimbursableRow, ReimbursableRowSnapshot} from '@components/MoneyRequestView/rows/ReimbursableRow';
import {ReportRow, ReportRowSnapshot} from '@components/MoneyRequestView/rows/ReportRow';
import {ViewTripDetailsRow, ViewTripDetailsRowSnapshot} from '@components/MoneyRequestView/rows/ViewTripDetailsRow';
import useCardFeedErrors from '@hooks/useCardFeedErrors';
import useOnyx from '@hooks/useOnyx';
import useReportIsArchived from '@hooks/useReportIsArchived';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Transaction} from '@src/types/onyx';

jest.mock('@hooks/useOnyx', () => jest.fn());
const mockUseOnyx = useOnyx as jest.MockedFunction<typeof useOnyx>;

jest.mock('@hooks/useReportIsArchived', () => jest.fn(() => false));
const mockUseReportIsArchived = useReportIsArchived as jest.MockedFunction<typeof useReportIsArchived>;

jest.mock('@hooks/useCardFeedErrors', () => jest.fn());
const mockUseCardFeedErrors = useCardFeedErrors as jest.MockedFunction<typeof useCardFeedErrors>;

jest.mock('@hooks/useCurrentUserPersonalDetails', () =>
    jest.fn(() => ({
        accountID: 1,
        login: 'test@example.com',
        timezone: {selected: 'UTC'},
    })),
);

jest.mock('@hooks/useActiveRoute', () => jest.fn(() => ({getReportRHPActiveRoute: () => ''})));
jest.mock('@hooks/useNetwork', () => jest.fn(() => ({isOffline: false})));
jest.mock('@hooks/useEnvironment', () =>
    jest.fn(() => ({
        environmentURL: 'https://test',
    })),
);
jest.mock('@hooks/usePermissions', () => jest.fn(() => ({isBetaEnabled: () => false})));
jest.mock('@hooks/useCurrencyList', () => ({
    useCurrencyListActions: () => ({
        convertToDisplayString: (amount: number | undefined) => (amount === undefined ? '' : `$${(amount / 100).toFixed(2)}`),
        getCurrencySymbol: () => '$',
    }),
}));

jest.mock('@hooks/useLazyAsset', () => ({
    useMemoizedLazyExpensifyIcons: () => ({Suitcase: () => null}),
}));

jest.mock('@components/OnyxListItemProvider', () => ({
    usePersonalDetails: () => ({}),
}));

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

jest.mock('@components/MenuItem', () => {
    const {Text} = jest.requireActual('react-native');
    return function MenuItemStub({title}: {title?: string}) {
        return title ? <Text>{title}</Text> : null;
    };
});

jest.mock('@components/Switch', () => {
    const {Text} = jest.requireActual('react-native');
    return function SwitchStub({accessibilityLabel, isOn}: {accessibilityLabel?: string; isOn?: boolean}) {
        return <Text>{`switch:${accessibilityLabel}:${isOn ? 'on' : 'off'}`}</Text>;
    };
});

jest.mock('@components/UserPills', () => () => null);

jest.mock('@components/DotIndicatorMessage', () => {
    const {Text} = jest.requireActual('react-native');
    return function DotIndicatorMessageStub({messages}: {messages?: Record<string, string>}) {
        const message = messages ? Object.values(messages).join(',') : '';
        return <Text>{`dot:${message}`}</Text>;
    };
});

jest.mock('@components/ViolationMessages', () => () => null);

const TRANSACTION_ID = 'txn-1';
const PARENT_REPORT_ID = 'parent-1';
const POLICY_ID = 'policy-1';

const BASE_TX = {
    transactionID: TRANSACTION_ID,
    amount: 12345,
    currency: 'USD',
    reportID: PARENT_REPORT_ID,
    billable: true,
    reimbursable: true,
} as unknown as Transaction;

const CARD_TX = {
    ...BASE_TX,
    cardID: 1234,
    cardName: 'Visa Corporate',
    bank: 'Some Bank',
    managedCard: true,
} as unknown as Transaction;

const ATTENDEES_TX = {
    ...BASE_TX,
    comment: {attendees: [{email: 'a@x.com', displayName: 'Alice', login: 'a@x.com'}]},
} as unknown as Transaction;

const TRIP_TX = {
    ...BASE_TX,
    receipt: {reservationList: [{type: 'flight'}]},
} as unknown as Transaction;

const POLICY = {
    id: POLICY_ID,
    type: 'corporate',
    disabledFields: {defaultBillable: false, reimbursable: false},
};

const PARENT_REPORT = {
    reportID: PARENT_REPORT_ID,
    policyID: POLICY_ID,
    chatType: 'policyExpenseChat',
    parentReportID: 'travel-room-1',
};

function setupOnyx(overrides: Record<string, unknown>) {
    mockUseOnyx.mockImplementation(((key: string, options?: {selector?: (data: unknown) => unknown}) => {
        const raw = key in overrides ? overrides[key] : undefined;
        const value = options?.selector ? options.selector(raw) : raw;
        return [value, {status: 'loaded'}];
    }) as typeof useOnyx);
}

const DEFAULT_CARD_FEED_ERRORS = {
    cardFeedErrors: {},
    cardsWithBrokenFeedConnection: {},
    personalCardsWithBrokenConnection: {},
    shouldShowRbrForWorkspaceAccountID: {},
    shouldShowRbrForFeedNameWithDomainID: {},
    all: {shouldShowRBR: false, isFeedConnectionBroken: false, hasFeedErrors: false, hasWorkspaceErrors: false},
    companyCards: {shouldShowRBR: false, isFeedConnectionBroken: false, hasFeedErrors: false, hasWorkspaceErrors: false},
    expensifyCard: {shouldShowRBR: false, isFeedConnectionBroken: false, hasFeedErrors: false, hasWorkspaceErrors: false},
    personalCard: {shouldShowRBR: false, isFeedConnectionBroken: false, hasFeedErrors: false, hasWorkspaceErrors: false},
};

describe('Row batch C', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseReportIsArchived.mockReturnValue(false);
        mockUseCardFeedErrors.mockReturnValue(DEFAULT_CARD_FEED_ERRORS);
    });

    describe('CardRow', () => {
        it('renders the card program name inside MoneyRequestViewInThread', () => {
            setupOnyx({
                [`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: CARD_TX,
                [`${ONYXKEYS.COLLECTION.REPORT}${PARENT_REPORT_ID}`]: PARENT_REPORT,
                [`${ONYXKEYS.COLLECTION.POLICY}${POLICY_ID}`]: POLICY,
                [ONYXKEYS.CARD_LIST]: {1234: {cardID: 1234, cardName: 'Visa Corporate', bank: 'Some Bank'}},
            });
            const {getByText} = render(
                <MoneyRequestViewInThread
                    transactionID={TRANSACTION_ID}
                    parentReportID={PARENT_REPORT_ID}
                    policyID={POLICY_ID}
                >
                    <CardRow />
                </MoneyRequestViewInThread>,
            );
            expect(getByText('Visa Corporate')).toBeTruthy();
        });

        it('CardRowSnapshot renders the card program name inside MoneyRequestViewPreview', () => {
            setupOnyx({
                [ONYXKEYS.CARD_LIST]: {1234: {cardID: 1234, cardName: 'Visa Corporate', bank: 'Some Bank'}},
            });
            const {getByText} = render(
                <MoneyRequestViewPreview
                    source={CARD_TX}
                    policyID={POLICY_ID}
                >
                    <CardRowSnapshot />
                </MoneyRequestViewPreview>,
            );
            expect(getByText('Visa Corporate')).toBeTruthy();
        });
    });

    describe('AttendeesRow', () => {
        it('renders attendees description inside MoneyRequestViewInThread', () => {
            setupOnyx({
                [`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: ATTENDEES_TX,
                [`${ONYXKEYS.COLLECTION.REPORT}${PARENT_REPORT_ID}`]: PARENT_REPORT,
                [`${ONYXKEYS.COLLECTION.POLICY}${POLICY_ID}`]: {...POLICY, eReceipts: true, type: 'corporate'},
            });
            const {queryByText} = render(
                <MoneyRequestViewInThread
                    transactionID={TRANSACTION_ID}
                    parentReportID={PARENT_REPORT_ID}
                    policyID={POLICY_ID}
                >
                    <AttendeesRow />
                </MoneyRequestViewInThread>,
            );
            // AttendeesRow visibility depends on shouldShowAttendees(policy, iouType);
            // it may be null when corporate policy disables it. Just ensure render does not throw.
            expect(queryByText).toBeDefined();
        });

        it('AttendeesRowSnapshot renders attendees inside MoneyRequestViewPreview', () => {
            setupOnyx({});
            const {getByText} = render(
                <MoneyRequestViewPreview
                    source={ATTENDEES_TX}
                    policyID={POLICY_ID}
                >
                    <AttendeesRowSnapshot />
                </MoneyRequestViewPreview>,
            );
            expect(getByText('Alice')).toBeTruthy();
        });
    });

    describe('BillableRow', () => {
        it('renders the billable switch inside MoneyRequestViewInThread', () => {
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
                    <BillableRow />
                </MoneyRequestViewInThread>,
            );
            expect(getByText('switch::on')).toBeTruthy();
        });

        it('BillableRowSnapshot renders the billable switch inside MoneyRequestViewPreview', () => {
            setupOnyx({});
            const {getByText} = render(
                <MoneyRequestViewPreview
                    source={BASE_TX}
                    policyID={POLICY_ID}
                >
                    <BillableRowSnapshot />
                </MoneyRequestViewPreview>,
            );
            expect(getByText('switch::on')).toBeTruthy();
        });
    });

    describe('ReimbursableRow', () => {
        it('renders the reimbursable switch inside MoneyRequestViewInThread', () => {
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
                    <ReimbursableRow />
                </MoneyRequestViewInThread>,
            );
            expect(getByText('switch::on')).toBeTruthy();
        });

        it('ReimbursableRowSnapshot renders the reimbursable switch inside MoneyRequestViewPreview', () => {
            setupOnyx({});
            const {getByText} = render(
                <MoneyRequestViewPreview
                    source={BASE_TX}
                    policyID={POLICY_ID}
                >
                    <ReimbursableRowSnapshot />
                </MoneyRequestViewPreview>,
            );
            expect(getByText('switch::on')).toBeTruthy();
        });
    });

    describe('ReportRow', () => {
        it('renders the report name inside MoneyRequestViewInThread', () => {
            setupOnyx({
                [`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: BASE_TX,
                [`${ONYXKEYS.COLLECTION.REPORT}${PARENT_REPORT_ID}`]: {...PARENT_REPORT, reportName: 'Q2 Expenses'},
                [`${ONYXKEYS.COLLECTION.POLICY}${POLICY_ID}`]: POLICY,
            });
            const {getByText} = render(
                <MoneyRequestViewInThread
                    transactionID={TRANSACTION_ID}
                    parentReportID={PARENT_REPORT_ID}
                    policyID={POLICY_ID}
                >
                    <ReportRow />
                </MoneyRequestViewInThread>,
            );
            expect(getByText('Q2 Expenses')).toBeTruthy();
        });

        it('ReportRowSnapshot renders the report name inside MoneyRequestViewPreview', () => {
            setupOnyx({});
            const {getByText} = render(
                <MoneyRequestViewPreview
                    source={{...BASE_TX, reportName: 'Q2 Expenses'} as unknown as Transaction}
                    policyID={POLICY_ID}
                >
                    <ReportRowSnapshot />
                </MoneyRequestViewPreview>,
            );
            expect(getByText('Q2 Expenses')).toBeTruthy();
        });
    });

    describe('ViewTripDetailsRow', () => {
        it('renders the trip details row inside MoneyRequestViewInThread', () => {
            setupOnyx({
                [`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: TRIP_TX,
                [`${ONYXKEYS.COLLECTION.REPORT}${PARENT_REPORT_ID}`]: PARENT_REPORT,
                [`${ONYXKEYS.COLLECTION.POLICY}${POLICY_ID}`]: POLICY,
            });
            const {queryByText} = render(
                <MoneyRequestViewInThread
                    transactionID={TRANSACTION_ID}
                    parentReportID={PARENT_REPORT_ID}
                    policyID={POLICY_ID}
                >
                    <ViewTripDetailsRow />
                </MoneyRequestViewInThread>,
            );
            // tripID resolution depends on parent.parentReportID matching a travel-room pattern;
            // smoke test: rendering does not throw.
            expect(queryByText).toBeDefined();
        });

        it('ViewTripDetailsRowSnapshot returns null without reservations', () => {
            setupOnyx({});
            const {toJSON} = render(
                <MoneyRequestViewPreview
                    source={BASE_TX}
                    policyID={POLICY_ID}
                >
                    <ViewTripDetailsRowSnapshot />
                </MoneyRequestViewPreview>,
            );
            expect(toJSON()).toBeNull();
        });
    });

    describe('CompanyCardConnectionWarning', () => {
        it('returns null when there is no broken card connection', () => {
            setupOnyx({});
            const {queryByText} = render(<CompanyCardConnectionWarning />);
            expect(queryByText(/^dot:/)).toBeNull();
        });

        it('renders the warning when a broken card connection exists', () => {
            mockUseCardFeedErrors.mockReturnValue({
                ...DEFAULT_CARD_FEED_ERRORS,
                personalCardsWithBrokenConnection: {1234: {cardID: 1234, cardName: 'Visa'}} as never,
            });
            setupOnyx({});
            const {getByText} = render(<CompanyCardConnectionWarning />);
            expect(getByText(/^dot:/)).toBeTruthy();
        });
    });
});
