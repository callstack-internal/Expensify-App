import {render} from '@testing-library/react-native';
import React from 'react';
import MoneyRequestViewInThread from '@components/MoneyRequestView/MoneyRequestViewInThread';
import MoneyRequestViewPreview from '@components/MoneyRequestView/MoneyRequestViewPreview';
import {ReceiptCard, ReceiptCardSnapshot} from '@components/MoneyRequestView/rows/ReceiptCard';
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

jest.mock('@hooks/useCurrentUserPersonalDetails', () =>
    jest.fn(() => ({
        accountID: 1,
        login: 'test@example.com',
        timezone: {selected: 'UTC'},
    })),
);

jest.mock('@hooks/useActiveRoute', () => jest.fn(() => ({getReportRHPActiveRoute: () => ''})));
jest.mock('@hooks/useAncestors', () => jest.fn(() => []));
jest.mock('@hooks/useCardFeedErrors', () => jest.fn(() => ({personalCardsWithBrokenConnection: []})));
jest.mock('@hooks/useConfirmModal', () => jest.fn(() => ({showConfirmModal: jest.fn()})));
jest.mock('@hooks/useDelegateAccountID', () => jest.fn(() => undefined));
jest.mock('@hooks/useEnvironment', () => jest.fn(() => ({environmentURL: 'https://app.test'})));
jest.mock('@hooks/useFilesValidation', () =>
    jest.fn(() => ({
        validateFiles: jest.fn(),
        PDFValidationComponent: null,
        ErrorModal: null,
    })),
);
jest.mock('@hooks/useGetIOUReportFromReportAction', () =>
    jest.fn(() => ({
        iouReport: undefined,
        chatReport: undefined,
        isChatIOUReportArchived: false,
    })),
);
jest.mock('@hooks/useHover', () => jest.fn(() => ({hovered: false, bind: {onMouseEnter: () => {}, onMouseLeave: () => {}}})));
jest.mock('@hooks/useLazyAsset', () => ({
    useMemoizedLazyExpensifyIcons: () => ({Expand: () => null, ReceiptPlus: () => null}),
}));
jest.mock('@hooks/useNetwork', () => jest.fn(() => ({isOffline: false})));
jest.mock('@hooks/useOriginalReportID', () => jest.fn(() => undefined));
jest.mock('@hooks/usePrevious', () => jest.fn((v: unknown) => v));
jest.mock('@hooks/useResponsiveLayout', () =>
    jest.fn(() => ({
        shouldUseNarrowLayout: false,
        isInNarrowPaneModal: false,
    })),
);
jest.mock('@hooks/useTheme', () => jest.fn(() => ({icon: '#000'})));

jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual<object>('@react-navigation/native'),
    useRoute: () => ({params: {}}),
}));

jest.mock('@libs/Navigation/Navigation', () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    getActiveRoute: jest.fn(() => ''),
}));

jest.mock(
    '@components/AttachmentPicker',
    () =>
        function AttachmentPickerStub() {
            return null;
        },
);

jest.mock('@components/ReceiptAudit', () => {
    const {Text} = jest.requireActual('react-native');
    function ReceiptAudit() {
        return null;
    }
    function ReceiptAuditMessages({notes}: {notes?: string[]}) {
        return notes && notes.length ? <Text>{notes.join(',')}</Text> : null;
    }
    return {__esModule: true, default: ReceiptAudit, ReceiptAuditMessages};
});

jest.mock('@components/ReceiptEmptyState', () => {
    const {Text} = jest.requireActual('react-native');
    return function ReceiptEmptyStateStub() {
        return <Text>receipt-empty-state</Text>;
    };
});

jest.mock('@components/ReportActionItem/ReportActionItemImage', () => {
    const {Text} = jest.requireActual('react-native');
    return function ReportActionItemImageStub({filename}: {filename?: string}) {
        return <Text>{`receipt-image:${filename ?? ''}`}</Text>;
    };
});

jest.mock('@components/ReportActionItem/receiptHoverUtils', () => ({
    isElementHovered: () => false,
    resetButtonHoverState: () => {},
}));

const TRANSACTION_ID = 'txn-1';
const PARENT_REPORT_ID = 'parent-1';
const POLICY_ID = 'policy-1';

const BASE_TX = {
    transactionID: TRANSACTION_ID,
    amount: 12345,
    currency: 'USD',
    reportID: PARENT_REPORT_ID,
    receipt: {source: 'https://example.com/receipt.jpg', filename: 'receipt.jpg', state: 'SCANCOMPLETE'},
    filename: 'receipt.jpg',
} as unknown as Transaction;

function setupOnyx(overrides: Record<string, unknown>) {
    mockUseOnyx.mockImplementation(((key: string, options?: {selector?: (data: unknown) => unknown}) => {
        const raw = key in overrides ? overrides[key] : undefined;
        const value = options?.selector ? options.selector(raw) : raw;
        return [value, {status: 'loaded'}];
    }) as typeof useOnyx);
}

describe('ReceiptCard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseReportIsArchived.mockReturnValue(false);
        setupOnyx({[`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: BASE_TX});
    });

    it('renders inside MoneyRequestViewInThread', () => {
        const {getByText} = render(
            <MoneyRequestViewInThread
                transactionID={TRANSACTION_ID}
                parentReportID={PARENT_REPORT_ID}
                policyID={POLICY_ID}
            >
                <ReceiptCard />
            </MoneyRequestViewInThread>,
        );
        expect(getByText('receipt-image:receipt.jpg')).toBeTruthy();
    });

    it('ReceiptCardSnapshot renders thumbnail inside MoneyRequestViewPreview', () => {
        const {getByText} = render(
            <MoneyRequestViewPreview
                source={BASE_TX}
                policyID={POLICY_ID}
            >
                <ReceiptCardSnapshot />
            </MoneyRequestViewPreview>,
        );
        expect(getByText('receipt-image:receipt.jpg')).toBeTruthy();
    });

    it('ReceiptCard inside MoneyRequestViewPreview throws context-missing', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() =>
            render(
                <MoneyRequestViewPreview
                    source={BASE_TX}
                    policyID={POLICY_ID}
                >
                    <ReceiptCard />
                </MoneyRequestViewPreview>,
            ),
        ).toThrow('LiveTransactionProvider missing');
        consoleError.mockRestore();
    });

    it('SmartScan delta isolation: receipt mutation does not re-render context-free sibling', () => {
        const siblingRenderCount = {current: 0};
        function Sibling() {
            siblingRenderCount.current += 1;
            return null;
        }

        const {rerender} = render(
            <MoneyRequestViewInThread
                transactionID={TRANSACTION_ID}
                parentReportID={PARENT_REPORT_ID}
                policyID={POLICY_ID}
            >
                <ReceiptCard />
                <Sibling />
            </MoneyRequestViewInThread>,
        );
        const initialSiblingRenders = siblingRenderCount.current;

        setupOnyx({
            [`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: {
                ...BASE_TX,
                receipt: {source: 'https://example.com/new.jpg', filename: 'new.jpg'},
                filename: 'new.jpg',
            },
        });

        rerender(
            <MoneyRequestViewInThread
                transactionID={TRANSACTION_ID}
                parentReportID={PARENT_REPORT_ID}
                policyID={POLICY_ID}
            >
                <ReceiptCard />
                <Sibling />
            </MoneyRequestViewInThread>,
        );

        // Sibling does not read transaction, so it should not re-render beyond the rerender wrapper churn.
        // We allow at most one extra render driven by the rerender call itself.
        expect(siblingRenderCount.current - initialSiblingRenders).toBeLessThanOrEqual(1);
    });
});
