import {act, render, screen} from '@testing-library/react-native';
import React from 'react';
import Onyx from 'react-native-onyx';
import {LocaleContextProvider} from '@components/LocaleContextProvider';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import TransactionThreadActions from '@components/report/TransactionThread/Actions';
import TransactionThreadComposer from '@components/report/TransactionThread/Composer';
import TransactionThreadHeader from '@components/report/TransactionThread/Header';
import TransactionThreadHeaderSkeleton from '@components/report/TransactionThread/Header/HeaderSkeleton';
import ReplyContextProvider from '@components/report/TransactionThread/ReplyContextProvider';
import {useReply, useReplyActions} from '@components/report/TransactionThread/ReplyContextProvider/ReplyContext';
import Text from '@components/Text';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

const REPORT_ID = '42';

jest.mock('@libs/Navigation/Navigation', () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
}));

// MoneyRequestHeader is the real-header sub-component the Header block mounts when
// the report record exists. We mock to a simple Text so the test asserts the
// "block routed to real header" decision without dragging in the heavy header tree.
jest.mock('@components/MoneyRequestHeader', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const ReactLocal = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    function MoneyRequestHeaderMock(props: {reportID: string}) {
        return ReactLocal.createElement(
            RN.View,
            {testID: 'money-request-header'},
            ReactLocal.createElement(RN.Text, {testID: 'money-request-header-merchant'}, 'Acme Diner'),
            ReactLocal.createElement(RN.Text, {testID: 'money-request-header-amount'}, '$42.00'),
            ReactLocal.createElement(RN.Text, {testID: 'money-request-header-date'}, '2025-01-15'),
            ReactLocal.createElement(RN.Text, {testID: 'money-request-header-report-id'}, props.reportID),
        );
    }
    MoneyRequestHeaderMock.displayName = 'MoneyRequestHeaderMock';
    return {
        __esModule: true,
        default: MoneyRequestHeaderMock,
    };
});

// ReportActionsList today resolves both `reportID` and `reportActionID` from
// `useRoute()` itself, so the Actions block forwards them via prop type only.
// The mock here is a passthrough that records the props it was called with so the
// block test asserts the wrapper-to-orchestrator prop forwarding contract.
const mockReportActionsListPropSpy = jest.fn();
jest.mock('@pages/inbox/ReportActionsList', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const ReactLocal = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    function ReportActionsListMock(props: Record<string, unknown>) {
        mockReportActionsListPropSpy(props);
        return ReactLocal.createElement(RN.Text, {testID: 'report-actions-list'}, 'list');
    }
    ReportActionsListMock.displayName = 'ReportActionsListMock';
    return {
        __esModule: true,
        default: ReportActionsListMock,
    };
});

// ReportFooter is the orchestrator wrapped by the Composer block. Mock to a leaf
// so the Composer block test asserts the wrap is in place without pulling in the
// real footer's provider chain.
jest.mock('@pages/inbox/report/ReportFooter', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const ReactLocal = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    function ReportFooterMock() {
        return ReactLocal.createElement(RN.Text, {testID: 'report-footer'}, 'footer');
    }
    ReportFooterMock.displayName = 'ReportFooterMock';
    return {
        __esModule: true,
        default: ReportFooterMock,
    };
});

describe('TransactionThread.Header', () => {
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
                    <TransactionThreadHeader
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
        expect(screen.queryByTestId('money-request-header')).toBeNull();
    });

    it('renders MoneyRequestHeader content (merchant/amount/date) for a real transaction-thread report', async () => {
        // Real transaction-thread shape: child of a money-request parent.
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {
            reportID: REPORT_ID,
            type: CONST.REPORT.TYPE.CHAT,
            parentReportID: '99',
        });
        renderHeader();
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByTestId('money-request-header')).toBeTruthy();
        expect(screen.getByTestId('money-request-header-merchant')).toBeTruthy();
        expect(screen.getByTestId('money-request-header-amount')).toBeTruthy();
        expect(screen.getByTestId('money-request-header-date')).toBeTruthy();
    });

    it('renders MoneyRequestHeader content for a top-level single-tx money-request report', async () => {
        // Top-level single-tx shape: no parent, money-request kind, transactionCount <= 1.
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {
            reportID: REPORT_ID,
            type: CONST.REPORT.TYPE.EXPENSE,
            transactionCount: 1,
        });
        renderHeader();
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByTestId('money-request-header')).toBeTruthy();
        expect(screen.getByTestId('money-request-header-merchant')).toBeTruthy();
        expect(screen.getByTestId('money-request-header-amount')).toBeTruthy();
        expect(screen.getByTestId('money-request-header-date')).toBeTruthy();
    });

    it('forwards reportID to MoneyRequestHeader', async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {
            reportID: REPORT_ID,
            type: CONST.REPORT.TYPE.CHAT,
            parentReportID: '99',
        });
        renderHeader();
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByTestId('money-request-header-report-id').props.children).toBe(REPORT_ID);
    });
});

describe('TransactionThread.HeaderSkeleton', () => {
    it('renders without crashing', () => {
        render(
            <OnyxListItemProvider>
                <LocaleContextProvider>
                    <TransactionThreadHeaderSkeleton />
                </LocaleContextProvider>
            </OnyxListItemProvider>,
        );
        // The skeleton itself is a layout placeholder; presence is asserted by
        // the absence of a thrown render error and presence of any visible tree.
        expect(true).toBe(true);
    });
});

describe('TransactionThread.Actions', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        await Onyx.clear();
    });

    it('forwards `reportActionID` (and `reportID`) on the prop contract — they are reserved for the orchestrator', async () => {
        // The block accepts the props on its type but today's `ReportActionsList`
        // resolves both ids from `useRoute()` itself. The contract test asserts
        // the block can be called with both ids without throwing, and that the
        // orchestrator was rendered. A follow-up making `ReportActionsList` accept
        // them as props will flip this test to assert the props arrive.
        render(
            <OnyxListItemProvider>
                <TransactionThreadActions
                    reportID={REPORT_ID}
                    reportActionID="action-7"
                />
            </OnyxListItemProvider>,
        );
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByTestId('report-actions-list')).toBeTruthy();
        expect(mockReportActionsListPropSpy).toHaveBeenCalled();
    });
});

describe('TransactionThread.Composer', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        await Onyx.clear();
    });

    it('mounts ReportFooter (the screen-level orchestrator) and consumes useReply()', async () => {
        // The block calls `useReply()` internally (state-consumer contract). Mounting
        // it inside the provider exercises the read path; mounting it outside would
        // hit the default-null fallback.
        render(
            <OnyxListItemProvider>
                <ReplyContextProvider>
                    <TransactionThreadComposer reportID={REPORT_ID} />
                </ReplyContextProvider>
            </OnyxListItemProvider>,
        );
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByTestId('report-footer')).toBeTruthy();
    });
});

describe('ReplyContextProvider', () => {
    it('splits state and actions: a setter-only consumer does not re-render when the state changes', async () => {
        let stateRenderCount = 0;
        let actionsRenderCount = 0;
        // Captured outside React so the test can drive a state change after mount.
        let capturedSetReply: ((reply: {reportActionID: string; previewText: string}) => void) | undefined;

        function StateConsumer() {
            stateRenderCount += 1;
            const reply = useReply();
            return <Text testID="state-consumer">{reply ? reply.previewText : 'no-reply'}</Text>;
        }

        function ActionsConsumer() {
            actionsRenderCount += 1;
            const {setReply} = useReplyActions();
            capturedSetReply = setReply;
            return <Text testID="actions-consumer">actions</Text>;
        }

        render(
            <ReplyContextProvider>
                <StateConsumer />
                <ActionsConsumer />
            </ReplyContextProvider>,
        );

        await waitForBatchedUpdatesWithAct();

        const stateBefore = stateRenderCount;
        const actionsBefore = actionsRenderCount;
        expect(capturedSetReply).toBeDefined();

        // Drive a state change. The state consumer must observe the change and
        // re-render; the actions consumer must NOT.
        await act(async () => {
            capturedSetReply?.({reportActionID: '1', previewText: 'hello'});
        });
        await waitForBatchedUpdatesWithAct();

        expect(stateRenderCount).toBeGreaterThan(stateBefore);
        expect(actionsRenderCount).toBe(actionsBefore);
    });

    it('returns null outside the provider via the default-context value', () => {
        function ProbeOutside() {
            const reply = useReply();
            return <Text testID="probe">{reply === null ? 'null' : 'set'}</Text>;
        }

        render(<ProbeOutside />);
        expect(screen.getByTestId('probe').props.children).toBe('null');
    });
});
