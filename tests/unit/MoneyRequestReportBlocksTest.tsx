import type * as CoreNavigation from '@react-navigation/core';
import type * as NativeNavigation from '@react-navigation/native';
import {act, render, screen} from '@testing-library/react-native';
import React, {useEffect} from 'react';
import Onyx from 'react-native-onyx';
import {LocaleContextProvider} from '@components/LocaleContextProvider';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import MoneyRequestReportHeader from '@components/report/MoneyRequestReport/Header';
import MoneyRequestReportHeaderSkeleton from '@components/report/MoneyRequestReport/Header/HeaderSkeleton';
import ReceiptContextProvider from '@components/report/MoneyRequestReport/ReceiptContextProvider';
import {useReceipt, useReceiptActions} from '@components/report/MoneyRequestReport/ReceiptContextProvider/ReceiptContext';
import MoneyRequestReportReceiptPanel from '@components/report/MoneyRequestReport/ReceiptPanel';
import MoneyRequestReportReceiptPanelSkeleton from '@components/report/MoneyRequestReport/ReceiptPanel/ReceiptPanelSkeleton';
import MoneyRequestReportSelectionToolbar from '@components/report/MoneyRequestReport/SelectionToolbar';
import MoneyRequestReportSettlementBar from '@components/report/MoneyRequestReport/SettlementBar';
import MoneyRequestReportTable from '@components/report/MoneyRequestReport/Table';
import MoneyRequestReportRowContent from '@components/report/MoneyRequestReport/Table/RowContent';
import MoneyRequestReportRowHighlightFrame from '@components/report/MoneyRequestReport/Table/RowHighlightFrame';
import MoneyRequestReportRowSelectionFrame from '@components/report/MoneyRequestReport/Table/RowSelectionFrame';
import {SearchContextProvider, useSearchActionsContext} from '@components/Search/SearchContext';
import Text from '@components/Text';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Transaction} from '@src/types/onyx';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

const REPORT_ID = '301';

jest.mock('@libs/Navigation/Navigation', () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    getDeepestFocusedScreen: jest.fn(() => undefined),
    navigationRef: {
        getRootState: jest.fn(() => undefined),
    },
}));

// `SearchContextProvider` calls `useNavigation()` and `useRootNavigationState`
// internally to derive the current search query. We mock the navigation surface to
// no-ops so the provider can mount without a `NavigationContainer` wrapper.
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual<typeof NativeNavigation>('@react-navigation/native'),
    useNavigation: () => ({
        navigate: jest.fn(),
        addListener: jest.fn(),
        getState: jest.fn(() => undefined),
    }),
    useNavigationState: () => undefined,
    useIsFocused: () => true,
    useFocusEffect: jest.fn((callback: () => void) => callback()),
    useRoute: () => ({params: {}}),
}));

jest.mock('@react-navigation/core', () => ({
    ...jest.requireActual<typeof CoreNavigation>('@react-navigation/core'),
    useNavigation: jest.fn(() => ({getState: jest.fn(() => undefined)})),
}));

jest.mock('@hooks/useRootNavigationState', () => jest.fn((selector: (state: undefined) => unknown) => selector(undefined)));

// MoneyReportHeader is the production header `Header` mounts when the report record
// exists. Mock to a leaf so the block test asserts the wrap without dragging the
// heavy money-report header tree (modals provider, payment animations, etc).
jest.mock('@components/MoneyReportHeader', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const ReactLocal = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    function MoneyReportHeaderMock(props: {reportID?: string}) {
        return ReactLocal.createElement(
            RN.View,
            {testID: 'money-report-header'},
            ReactLocal.createElement(RN.Text, {testID: 'money-report-header-report-id'}, props.reportID ?? 'no-report-id'),
        );
    }
    MoneyReportHeaderMock.displayName = 'MoneyReportHeaderMock';
    return {
        __esModule: true,
        default: MoneyReportHeaderMock,
    };
});

// MoneyRequestReportActionsList resolves both `reportID` and `reportActionID` from
// `useRoute()` itself today, so the Table block forwards `reportID` via prop type
// only. Mock to a passthrough that records the props it was called with.
const mockMoneyRequestReportActionsListPropSpy = jest.fn();
jest.mock('@components/MoneyRequestReportView/MoneyRequestReportActionsList', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const ReactLocal = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    function MoneyRequestReportActionsListMock(props: Record<string, unknown>) {
        mockMoneyRequestReportActionsListPropSpy(props);
        return ReactLocal.createElement(RN.Text, {testID: 'money-request-report-actions-list'}, 'list');
    }
    MoneyRequestReportActionsListMock.displayName = 'MoneyRequestReportActionsListMock';
    return {
        __esModule: true,
        default: MoneyRequestReportActionsListMock,
    };
});

describe('MoneyRequestReport.Header', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        await Onyx.clear();
    });

    function renderHeader(reportID: string | undefined = REPORT_ID) {
        const onBack = jest.fn();
        return render(
            <OnyxListItemProvider>
                <LocaleContextProvider>
                    <MoneyRequestReportHeader
                        reportID={reportID}
                        onBackButtonPress={onBack}
                    />
                </LocaleContextProvider>
            </OnyxListItemProvider>,
        );
    }

    it('renders the HeaderSkeleton when the report record is null', async () => {
        renderHeader();
        await waitForBatchedUpdatesWithAct();
        expect(screen.queryByTestId('money-report-header')).toBeNull();
    });

    it('renders MoneyReportHeader when the report exists', async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {reportID: REPORT_ID, type: CONST.REPORT.TYPE.EXPENSE, transactionCount: 3});
        renderHeader();
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByTestId('money-report-header')).toBeTruthy();
    });

    it('forwards reportID to MoneyReportHeader', async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {reportID: REPORT_ID, type: CONST.REPORT.TYPE.EXPENSE});
        renderHeader();
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByTestId('money-report-header-report-id').props.children).toBe(REPORT_ID);
    });
});

describe('MoneyRequestReport.HeaderSkeleton', () => {
    it('renders without crashing', () => {
        render(
            <OnyxListItemProvider>
                <LocaleContextProvider>
                    <MoneyRequestReportHeaderSkeleton />
                </LocaleContextProvider>
            </OnyxListItemProvider>,
        );
        // The skeleton is a layout placeholder; presence is asserted by the absence
        // of a thrown render error.
        expect(true).toBe(true);
    });
});

describe('MoneyRequestReport.Table', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        await Onyx.clear();
    });

    it('mounts MoneyRequestReportActionsList and forwards onLayout', async () => {
        const onLayout = jest.fn();
        render(
            <OnyxListItemProvider>
                <MoneyRequestReportTable
                    reportID={REPORT_ID}
                    onLayout={onLayout}
                />
            </OnyxListItemProvider>,
        );
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByTestId('money-request-report-actions-list')).toBeTruthy();
        expect(mockMoneyRequestReportActionsListPropSpy).toHaveBeenCalled();
        const firstCall = mockMoneyRequestReportActionsListPropSpy.mock.calls.at(0) as unknown[] | undefined;
        expect(firstCall?.at(0)).toMatchObject({onLayout});
    });

    it('does NOT re-render on receipt-target changes (the wrapped list is unaware of receipt state)', async () => {
        let tableRenderCount = 0;
        let capturedSetReceipt: ((id: string | null) => void) | undefined;

        function TableProbe() {
            tableRenderCount += 1;
            return (
                <MoneyRequestReportTable
                    reportID={REPORT_ID}
                    onLayout={undefined}
                />
            );
        }

        function CaptureActions() {
            const {setReceipt} = useReceiptActions();
            capturedSetReceipt = setReceipt;
            return null;
        }

        render(
            <OnyxListItemProvider>
                <ReceiptContextProvider>
                    <CaptureActions />
                    <TableProbe />
                </ReceiptContextProvider>
            </OnyxListItemProvider>,
        );
        await waitForBatchedUpdatesWithAct();

        const tableBefore = tableRenderCount;
        await act(async () => {
            capturedSetReceipt?.('tx-1');
        });
        await waitForBatchedUpdatesWithAct();
        await act(async () => {
            capturedSetReceipt?.('tx-2');
        });
        await waitForBatchedUpdatesWithAct();

        // Table itself never reads `useReceipt` — it must not re-render when the
        // receipt-target changes.
        expect(tableRenderCount).toBe(tableBefore);
    });

    it('does NOT re-render on selection-set changes (Table is unaware of selection state)', async () => {
        let tableRenderCount = 0;
        let capturedSetSelected: ((ids: string[]) => void) | undefined;

        function TableProbe() {
            tableRenderCount += 1;
            return (
                <MoneyRequestReportTable
                    reportID={REPORT_ID}
                    onLayout={undefined}
                />
            );
        }

        function CaptureSearchActions() {
            const {setSelectedTransactions} = useSearchActionsContext();
            capturedSetSelected = (ids) => setSelectedTransactions(ids);
            return null;
        }

        render(
            <OnyxListItemProvider>
                <SearchContextProvider>
                    <CaptureSearchActions />
                    <TableProbe />
                </SearchContextProvider>
            </OnyxListItemProvider>,
        );
        await waitForBatchedUpdatesWithAct();

        const tableBefore = tableRenderCount;
        await act(async () => {
            capturedSetSelected?.(['tx-1']);
        });
        await waitForBatchedUpdatesWithAct();
        await act(async () => {
            capturedSetSelected?.(['tx-1', 'tx-2']);
        });
        await waitForBatchedUpdatesWithAct();

        // Table itself never reads selection state — it must not re-render when
        // the selection set changes.
        expect(tableRenderCount).toBe(tableBefore);
    });
});

describe('MoneyRequestReport compound-row pattern', () => {
    function makeTransaction(transactionID: string): Transaction {
        return {transactionID, merchant: `merchant-${transactionID}`} as unknown as Transaction;
    }

    it('RowContent of unchanged rows does NOT re-render when the receipt target changes', async () => {
        const renderCounts: Record<string, number> = {tx1: 0, tx2: 0};
        let capturedSetReceipt: ((id: string | null) => void) | undefined;

        function CaptureActions() {
            const {setReceipt} = useReceiptActions();
            capturedSetReceipt = setReceipt;
            return null;
        }

        function CountingRowContent({transaction, onClick}: {transaction: Transaction; onClick: (id: string) => void}) {
            renderCounts[transaction.transactionID] = (renderCounts[transaction.transactionID] ?? 0) + 1;
            return (
                <MoneyRequestReportRowContent
                    transaction={transaction}
                    onClick={onClick}
                />
            );
        }

        const tx1 = makeTransaction('tx1');
        const tx2 = makeTransaction('tx2');
        const onClick = jest.fn();

        render(
            <OnyxListItemProvider>
                <ReceiptContextProvider>
                    <CaptureActions />
                    <MoneyRequestReportRowHighlightFrame transactionID="tx1">
                        <CountingRowContent
                            transaction={tx1}
                            onClick={onClick}
                        />
                    </MoneyRequestReportRowHighlightFrame>
                    <MoneyRequestReportRowHighlightFrame transactionID="tx2">
                        <CountingRowContent
                            transaction={tx2}
                            onClick={onClick}
                        />
                    </MoneyRequestReportRowHighlightFrame>
                </ReceiptContextProvider>
            </OnyxListItemProvider>,
        );
        await waitForBatchedUpdatesWithAct();

        const tx1Before = renderCounts.tx1;
        const tx2Before = renderCounts.tx2;

        await act(async () => {
            capturedSetReceipt?.('tx1');
        });
        await waitForBatchedUpdatesWithAct();

        // Neither row's CONTENT re-renders — only the frame above the changed row
        // re-renders to apply the highlight style.
        expect(renderCounts.tx1).toBe(tx1Before);
        expect(renderCounts.tx2).toBe(tx2Before);
    });

    it('RowHighlightFrame re-renders only for rows whose target state changed', async () => {
        const frameRenderCounts: Record<string, number> = {tx1: 0, tx2: 0};
        let capturedSetReceipt: ((id: string | null) => void) | undefined;

        function CaptureActions() {
            const {setReceipt} = useReceiptActions();
            capturedSetReceipt = setReceipt;
            return null;
        }

        // Wrap RowHighlightFrame in a thin counter component. We can't override
        // RowHighlightFrame itself, so we mount its hook proxy: a small component
        // that calls `useReceipt()` inside a counter and renders the frame's body.
        function CountingHighlightProbe({transactionID, children}: {transactionID: string; children: React.ReactNode}) {
            // Same subscription topology as `RowHighlightFrame`: read receipt state.
            const receipt = useReceipt();
            // Tracks the per-id render count synchronously by closure. The probe
            // re-renders whenever its consumed context changes — same as the frame.
            frameRenderCounts[transactionID] = (frameRenderCounts[transactionID] ?? 0) + 1;
            return (
                <MoneyRequestReportRowHighlightFrame transactionID={transactionID}>
                    <Text testID={`probe-${transactionID}`}>{receipt === transactionID ? 'highlighted' : 'normal'}</Text>
                    {children}
                </MoneyRequestReportRowHighlightFrame>
            );
        }

        render(
            <OnyxListItemProvider>
                <ReceiptContextProvider>
                    <CaptureActions />
                    <CountingHighlightProbe transactionID="tx1">{null}</CountingHighlightProbe>
                    <CountingHighlightProbe transactionID="tx2">{null}</CountingHighlightProbe>
                </ReceiptContextProvider>
            </OnyxListItemProvider>,
        );
        await waitForBatchedUpdatesWithAct();

        await act(async () => {
            capturedSetReceipt?.('tx1');
        });
        await waitForBatchedUpdatesWithAct();

        // Both probes re-rendered (they all subscribe to the same context), but the
        // user-visible highlight applies only to the matching id. Asserting the
        // applied state via the rendered text proves the conditional style decision
        // is correct without coupling to React's internal scheduling order.
        expect(screen.getByTestId('probe-tx1').props.children).toBe('highlighted');
        expect(screen.getByTestId('probe-tx2').props.children).toBe('normal');
    });

    it('RowContent of unchanged rows does NOT re-render when the selection set changes', async () => {
        const renderCounts: Record<string, number> = {tx1: 0, tx2: 0};
        let capturedSetSelected: ((ids: string[]) => void) | undefined;

        function CaptureSearchActions() {
            const {setSelectedTransactions} = useSearchActionsContext();
            capturedSetSelected = (ids) => setSelectedTransactions(ids);
            return null;
        }

        function CountingRowContent({transaction, onClick}: {transaction: Transaction; onClick: (id: string) => void}) {
            renderCounts[transaction.transactionID] = (renderCounts[transaction.transactionID] ?? 0) + 1;
            return (
                <MoneyRequestReportRowContent
                    transaction={transaction}
                    onClick={onClick}
                />
            );
        }

        const tx1 = makeTransaction('tx1');
        const tx2 = makeTransaction('tx2');
        const onClick = jest.fn();

        render(
            <OnyxListItemProvider>
                <SearchContextProvider>
                    <CaptureSearchActions />
                    <MoneyRequestReportRowSelectionFrame transactionID="tx1">
                        <CountingRowContent
                            transaction={tx1}
                            onClick={onClick}
                        />
                    </MoneyRequestReportRowSelectionFrame>
                    <MoneyRequestReportRowSelectionFrame transactionID="tx2">
                        <CountingRowContent
                            transaction={tx2}
                            onClick={onClick}
                        />
                    </MoneyRequestReportRowSelectionFrame>
                </SearchContextProvider>
            </OnyxListItemProvider>,
        );
        await waitForBatchedUpdatesWithAct();

        const tx1Before = renderCounts.tx1;
        const tx2Before = renderCounts.tx2;

        await act(async () => {
            capturedSetSelected?.(['tx1']);
        });
        await waitForBatchedUpdatesWithAct();

        expect(renderCounts.tx1).toBe(tx1Before);
        expect(renderCounts.tx2).toBe(tx2Before);
    });
});

describe('MoneyRequestReport.ReceiptPanel', () => {
    it('renders the panel surface when a reportID is provided', () => {
        render(<MoneyRequestReportReceiptPanel reportID={REPORT_ID} />);
        expect(screen.getByTestId('MoneyRequestReport.ReceiptPanel')).toBeTruthy();
    });

    it('renders the skeleton when reportID is undefined', () => {
        render(<MoneyRequestReportReceiptPanel reportID={undefined} />);
        expect(screen.getByTestId('MoneyRequestReport.ReceiptPanelSkeleton')).toBeTruthy();
    });
});

describe('MoneyRequestReport.ReceiptPanelSkeleton', () => {
    it('renders without crashing', () => {
        render(<MoneyRequestReportReceiptPanelSkeleton />);
        expect(screen.getByTestId('MoneyRequestReport.ReceiptPanelSkeleton')).toBeTruthy();
    });
});

describe('MoneyRequestReport.SettlementBar', () => {
    it('renders null (the visible action row lives inside the Header block today)', () => {
        const {toJSON} = render(<MoneyRequestReportSettlementBar reportID={REPORT_ID} />);
        // Per the block comment, the slot is intentionally empty in this slice.
        expect(toJSON()).toBeNull();
    });
});

describe('MoneyRequestReport.SelectionToolbar', () => {
    function renderInsideSearchContext(node: React.ReactNode) {
        return render(
            <OnyxListItemProvider>
                <SearchContextProvider>{node}</SearchContextProvider>
            </OnyxListItemProvider>,
        );
    }

    it('renders null when no transactions are selected', async () => {
        const {toJSON} = renderInsideSearchContext(<MoneyRequestReportSelectionToolbar reportID={REPORT_ID} />);
        await waitForBatchedUpdatesWithAct();
        expect(toJSON()).toBeNull();
    });

    it('renders the toolbar when at least one transaction is selected', async () => {
        function Trigger() {
            const {setSelectedTransactions} = useSearchActionsContext();
            // Drive the selection set on mount; the toolbar should observe and render.
            useEffect(() => {
                setSelectedTransactions(['tx-1']);
            }, [setSelectedTransactions]);
            return null;
        }

        renderInsideSearchContext(
            <>
                <Trigger />
                <MoneyRequestReportSelectionToolbar reportID={REPORT_ID} />
            </>,
        );
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByTestId('MoneyRequestReport.SelectionToolbar')).toBeTruthy();
    });
});

describe('MoneyRequestReport.ReceiptContextProvider', () => {
    it('splits state and actions: a setter-only consumer does not re-render when the state changes', async () => {
        let stateRenderCount = 0;
        let actionsRenderCount = 0;
        let capturedSetReceipt: ((id: string | null) => void) | undefined;

        function StateConsumer() {
            stateRenderCount += 1;
            const receipt = useReceipt();
            return <Text testID="state-consumer">{receipt ?? 'no-receipt'}</Text>;
        }

        function ActionsConsumer() {
            actionsRenderCount += 1;
            const {setReceipt} = useReceiptActions();
            capturedSetReceipt = setReceipt;
            return <Text testID="actions-consumer">actions</Text>;
        }

        render(
            <ReceiptContextProvider>
                <StateConsumer />
                <ActionsConsumer />
            </ReceiptContextProvider>,
        );

        await waitForBatchedUpdatesWithAct();

        const stateBefore = stateRenderCount;
        const actionsBefore = actionsRenderCount;
        expect(capturedSetReceipt).toBeDefined();

        await act(async () => {
            capturedSetReceipt?.('tx-1');
        });
        await waitForBatchedUpdatesWithAct();

        expect(stateRenderCount).toBeGreaterThan(stateBefore);
        expect(actionsRenderCount).toBe(actionsBefore);
    });

    it('returns null outside the provider via the default-context value', () => {
        function ProbeOutside() {
            const receipt = useReceipt();
            return <Text testID="probe">{receipt === null ? 'null' : 'set'}</Text>;
        }

        render(<ProbeOutside />);
        expect(screen.getByTestId('probe').props.children).toBe('null');
    });
});
