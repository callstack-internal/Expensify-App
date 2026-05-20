import {render, renderHook, screen} from '@testing-library/react-native';
import React from 'react';
import SnapshotViolationsProvider, {useAllViolations as useAllSnapshotViolations} from '@components/MoneyRequestView/contexts/SnapshotViolationsProvider';
import {useAllViolations as useAllLiveViolations} from '@components/MoneyRequestView/contexts/ViolationsProvider';
import MoneyRequestViewInThread from '@components/MoneyRequestView/MoneyRequestViewInThread';
import MoneyRequestViewPreview from '@components/MoneyRequestView/MoneyRequestViewPreview';
import {TransactionViolationsBlock, TransactionViolationsBlockSnapshot} from '@components/MoneyRequestView/rows/TransactionViolationsBlock';
import useOnyx from '@hooks/useOnyx';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Transaction, TransactionViolation} from '@src/types/onyx';

jest.mock('@hooks/useOnyx', () => jest.fn());
const mockUseOnyx = useOnyx as jest.MockedFunction<typeof useOnyx>;

jest.mock('@hooks/useLocalize', () =>
    jest.fn(() => ({
        translate: (key: string) => (key === 'violations.companyCardRequired' ? 'Company card purchases required' : key),
        preferredLocale: 'en',
        formatPhoneNumber: (n: string) => n,
        toLocaleDigit: (d: string) => d,
        toLocaleOrdinal: (n: number) => String(n),
        fromLocaleDigit: (d: string) => d,
        datetimeToCalendarTime: () => '',
        datetimeToRelative: () => '',
    })),
);

jest.mock('@components/DotIndicatorMessage', () => {
    const rn: {Text: React.ComponentType<{children?: React.ReactNode}>} = jest.requireActual('react-native');
    function DotIndicatorMessageStub({messages}: {messages?: Record<string, string>}) {
        const message = messages ? Object.values(messages).join(',') : '';
        return <rn.Text>{`dot:${message}`}</rn.Text>;
    }
    return DotIndicatorMessageStub;
});

const TRANSACTION_ID = 'txn-1';
const PARENT_REPORT_ID = 'parent-1';
const POLICY_ID = 'policy-1';

const BASE_TX = {
    transactionID: TRANSACTION_ID,
    amount: 12345,
    currency: 'USD',
    reportID: PARENT_REPORT_ID,
} as unknown as Transaction;

const COMPANY_CARD_REQUIRED: TransactionViolation = {
    name: CONST.VIOLATIONS.COMPANY_CARD_REQUIRED,
    type: CONST.VIOLATION_TYPES.VIOLATION,
} as TransactionViolation;

const OVER_LIMIT: TransactionViolation = {
    name: CONST.VIOLATIONS.OVER_LIMIT,
    type: CONST.VIOLATION_TYPES.VIOLATION,
} as TransactionViolation;

function setupOnyx(overrides: Record<string, unknown>) {
    mockUseOnyx.mockImplementation(((key: string, options?: {selector?: (data: unknown) => unknown}) => {
        const raw = key in overrides ? overrides[key] : undefined;
        const value = options?.selector ? options.selector(raw) : raw;
        return [value, {status: 'loaded'}];
    }) as typeof useOnyx);
}

describe('TransactionViolationsBlock', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the company-card-required indicator inside MoneyRequestViewInThread', () => {
        setupOnyx({
            [`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: BASE_TX,
            [`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${TRANSACTION_ID}`]: [COMPANY_CARD_REQUIRED],
        });
        render(
            <MoneyRequestViewInThread
                transactionID={TRANSACTION_ID}
                parentReportID={PARENT_REPORT_ID}
                policyID={POLICY_ID}
            >
                <TransactionViolationsBlock />
            </MoneyRequestViewInThread>,
        );
        expect(screen.getByText('dot:Company card purchases required')).toBeTruthy();
    });

    it('renders nothing when there is no company-card-required violation', () => {
        setupOnyx({
            [`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: BASE_TX,
            [`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${TRANSACTION_ID}`]: [OVER_LIMIT],
        });
        render(
            <MoneyRequestViewInThread
                transactionID={TRANSACTION_ID}
                parentReportID={PARENT_REPORT_ID}
                policyID={POLICY_ID}
            >
                <TransactionViolationsBlock />
            </MoneyRequestViewInThread>,
        );
        expect(screen.queryByText(/^dot:/)).toBeNull();
    });

    it('TransactionViolationsBlockSnapshot renders the indicator inside SnapshotViolationsProvider', () => {
        setupOnyx({});
        render(
            <MoneyRequestViewPreview
                source={BASE_TX}
                policyID={POLICY_ID}
            >
                <SnapshotViolationsProvider violations={[COMPANY_CARD_REQUIRED]}>
                    <TransactionViolationsBlockSnapshot />
                </SnapshotViolationsProvider>
            </MoneyRequestViewPreview>,
        );
        expect(screen.getByText('dot:Company card purchases required')).toBeTruthy();
    });

    it('live adapter throws inside MoneyRequestViewPreview (no live provider)', () => {
        setupOnyx({});
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() =>
            render(
                <MoneyRequestViewPreview
                    source={BASE_TX}
                    policyID={POLICY_ID}
                >
                    <TransactionViolationsBlock />
                </MoneyRequestViewPreview>,
            ),
        ).toThrow('ViolationsProvider missing');
        consoleError.mockRestore();
    });

    it('snapshot adapter throws when mounted outside SnapshotViolationsProvider', () => {
        setupOnyx({});
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() =>
            render(
                <MoneyRequestViewPreview
                    source={BASE_TX}
                    policyID={POLICY_ID}
                >
                    <TransactionViolationsBlockSnapshot />
                </MoneyRequestViewPreview>,
            ),
        ).toThrow('SnapshotViolationsProvider missing');
        consoleError.mockRestore();
    });

    it('parity: same fixture in both providers yields identical useAllViolations content', () => {
        const fixture: TransactionViolation[] = [COMPANY_CARD_REQUIRED, OVER_LIMIT];

        setupOnyx({
            [`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${TRANSACTION_ID}`]: fixture,
            [`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: BASE_TX,
        });

        const liveResult = renderHook(() => useAllLiveViolations(), {
            wrapper: ({children}) => (
                <MoneyRequestViewInThread
                    transactionID={TRANSACTION_ID}
                    parentReportID={PARENT_REPORT_ID}
                    policyID={POLICY_ID}
                >
                    {children}
                </MoneyRequestViewInThread>
            ),
        });

        const snapshotResult = renderHook(() => useAllSnapshotViolations(), {
            wrapper: ({children}) => <SnapshotViolationsProvider violations={fixture}>{children}</SnapshotViolationsProvider>,
        });

        expect(liveResult.result.current).toEqual(snapshotResult.result.current);
        expect(liveResult.result.current).toHaveLength(2);
    });
});
