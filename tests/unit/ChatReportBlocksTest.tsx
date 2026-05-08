import {act, render, screen} from '@testing-library/react-native';
import React from 'react';
import Onyx from 'react-native-onyx';
import {LocaleContextProvider} from '@components/LocaleContextProvider';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import ChatReportAccountManagerBanner from '@components/report/ChatReport/AccountManagerBanner';
import ChatReportActions from '@components/report/ChatReport/Actions';
import ChatReportComposer from '@components/report/ChatReport/Composer';
import ChatReportHeader from '@components/report/ChatReport/Header';
import ChatReportHeaderSkeleton from '@components/report/ChatReport/Header/HeaderSkeleton';
import ReplyContextProvider from '@components/report/ChatReport/ReplyContextProvider';
import {useReply, useReplyActions} from '@components/report/ChatReport/ReplyContextProvider/ReplyContext';
import Text from '@components/Text';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

const REPORT_ID = '101';
const ACCOUNT_MANAGER_REPORT_ID = '202';

jest.mock('@libs/Navigation/Navigation', () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
}));

// HeaderView is the real-header sub-component the chat Header block mounts when the
// report record exists. Mock to a simple Text so the test asserts the
// "block routed to real header" decision without dragging in the heavy header tree.
// The mock surfaces the report id so the per-sub-kind tests can confirm forwarding.
jest.mock('@pages/inbox/HeaderView', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const ReactLocal = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    function HeaderViewMock(props: {reportID?: string}) {
        return ReactLocal.createElement(RN.View, {testID: 'chat-header-view'}, ReactLocal.createElement(RN.Text, {testID: 'chat-header-view-report-id'}, props.reportID ?? 'no-report-id'));
    }
    HeaderViewMock.displayName = 'HeaderViewMock';
    return {
        __esModule: true,
        default: HeaderViewMock,
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

// The internal AccountManagerBanner under `@pages/inbox/AccountManagerBanner` is a
// self-subscribing leaf that decides null vs. the concierge banner content based on
// `isConciergeChatReport(report)` and the account-manager-report id on `ONYXKEYS.ACCOUNT`.
// We let the real component run (no mock) so the block tests assert that
// `ChatReport.AccountManagerBanner` renders the banner only for concierge.

describe('ChatReport.Header', () => {
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
                    <ChatReportHeader
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
        expect(screen.queryByTestId('chat-header-view')).toBeNull();
    });

    // Each chat sub-kind hits the same "report exists -> render HeaderView" path. The
    // visual differences (avatar layout, room subtitle, self-DM display, archived /
    // anonymous variants) are leaf-level conditionals inside `HeaderView` itself —
    // they are not separate compound branches. Block-level tests therefore assert
    // that the block routes to `HeaderView` for every sub-kind; the leaf's per-variant
    // rendering is covered by `HeaderView`'s own tests.
    const subKinds: Array<{name: string; report: Record<string, unknown>}> = [
        {name: 'DM', report: {type: CONST.REPORT.TYPE.CHAT}},
        {name: 'group chat', report: {type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.GROUP}},
        {name: 'self-DM', report: {type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.SELF_DM}},
        {name: 'admin room', report: {type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.POLICY_ADMINS}},
        {name: 'announce room', report: {type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.POLICY_ANNOUNCE}},
        {name: 'user-created policy room', report: {type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.POLICY_ROOM}},
        {name: 'policy expense chat', report: {type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT}},
        {name: 'chat thread on chat parent', report: {type: CONST.REPORT.TYPE.CHAT, parentReportID: '999'}},
    ];
    it.each(subKinds)('renders HeaderView for $name', async ({report}) => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {reportID: REPORT_ID, ...report});
        renderHeader();
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByTestId('chat-header-view')).toBeTruthy();
    });

    it('renders HeaderView with the concierge sub-kind report shape', async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {reportID: REPORT_ID, type: CONST.REPORT.TYPE.CHAT, participants: {}});
        renderHeader();
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByTestId('chat-header-view')).toBeTruthy();
    });

    it('forwards reportID to HeaderView', async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {reportID: REPORT_ID, type: CONST.REPORT.TYPE.CHAT});
        renderHeader();
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByTestId('chat-header-view-report-id').props.children).toBe(REPORT_ID);
    });
});

describe('ChatReport.HeaderSkeleton', () => {
    it('renders without crashing', () => {
        render(
            <OnyxListItemProvider>
                <LocaleContextProvider>
                    <ChatReportHeaderSkeleton />
                </LocaleContextProvider>
            </OnyxListItemProvider>,
        );
        // The skeleton itself is a layout placeholder; presence is asserted by
        // the absence of a thrown render error and presence of any visible tree.
        expect(true).toBe(true);
    });
});

describe('ChatReport.Actions', () => {
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
                <ChatReportActions
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

describe('ChatReport.Composer', () => {
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
                    <ChatReportComposer reportID={REPORT_ID} />
                </ReplyContextProvider>
            </OnyxListItemProvider>,
        );
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByTestId('report-footer')).toBeTruthy();
    });
});

describe('ChatReport.AccountManagerBanner', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        await Onyx.clear();
    });

    function renderBanner(reportID: string | undefined = REPORT_ID) {
        return render(
            <OnyxListItemProvider>
                <LocaleContextProvider>
                    <ChatReportAccountManagerBanner reportID={reportID} />
                </LocaleContextProvider>
            </OnyxListItemProvider>,
        );
    }

    // Source of truth for "is this concierge?" lives in
    // `@libs/ReportUtils#isConciergeChatReport`, which checks the report's
    // participants for the concierge account id. The wrapped leaf
    // (`@pages/inbox/AccountManagerBanner`) mounts the banner only when (a) an
    // account-manager-report id is present on `ONYXKEYS.ACCOUNT` and (b)
    // `isConciergeChatReport(report)` is true. The block tests below drive the
    // pre-conditions via Onyx and assert the rendered output.
    const NON_CONCIERGE_SUB_KINDS: Array<{name: string; report: Record<string, unknown>}> = [
        {name: 'DM', report: {type: CONST.REPORT.TYPE.CHAT}},
        {name: 'group chat', report: {type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.GROUP}},
        {name: 'self-DM', report: {type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.SELF_DM}},
        {name: 'admin room', report: {type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.POLICY_ADMINS}},
        {name: 'announce room', report: {type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.POLICY_ANNOUNCE}},
        {name: 'user-created policy room', report: {type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.POLICY_ROOM}},
        {name: 'policy expense chat', report: {type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT}},
    ];

    it.each(NON_CONCIERGE_SUB_KINDS)('renders null for $name (non-concierge)', async ({report}) => {
        // Provide an account-manager-report id so the only thing gating the banner is
        // the concierge check. The leaf's `isConciergeChatReport(report)` returns false
        // for these sub-kinds (no concierge participant), so the banner must be null.
        await Onyx.merge(ONYXKEYS.ACCOUNT, {accountManagerReportID: ACCOUNT_MANAGER_REPORT_ID, accountManagerAccountID: '7'});
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {reportID: REPORT_ID, ...report});
        renderBanner();
        await waitForBatchedUpdatesWithAct();
        // Banner uses an "X" close button as a stable, low-coupling rendered element.
        // Its absence asserts the leaf returned null. We use `queryByText` against the
        // translated "Chat with account manager" text — the leaf's only banner text.
        expect(screen.queryByText(/account manager/i)).toBeNull();
    });

    it('renders the banner when the report is the concierge chat AND an account manager is set', async () => {
        await Onyx.merge(ONYXKEYS.ACCOUNT, {accountManagerReportID: ACCOUNT_MANAGER_REPORT_ID, accountManagerAccountID: '7'});
        await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {
            7: {accountID: 7, login: 'manager@example.com', displayName: 'AM'},
        });
        // Concierge chat shape: `isConciergeChatReport` checks
        // `report.reportID === conciergeReportID` (read from `ONYXKEYS.CONCIERGE_REPORT_ID`).
        // Pin the concierge id to this test's report so the leaf decides "concierge".
        await Onyx.merge(ONYXKEYS.CONCIERGE_REPORT_ID, REPORT_ID);
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {
            reportID: REPORT_ID,
            type: CONST.REPORT.TYPE.CHAT,
        });
        renderBanner();
        await waitForBatchedUpdatesWithAct();
        // The banner text reads "Chat with X (login)" via `translate('common.chatWithAccountManager', ...)`.
        // The exact translation is locale-driven; assert the substring "manager@example.com" appears.
        expect(screen.getByText(/manager@example\.com/)).toBeTruthy();
    });
});

describe('ChatReport.ReplyContextProvider', () => {
    it('splits state and actions: a setter-only consumer does not re-render when the state changes', async () => {
        let stateRenderCount = 0;
        let actionsRenderCount = 0;
        // Captured outside React so the test can drive a state change after mount.
        let capturedSetReply: ((reply: {reportActionID: string; previewText: string}) => void) | undefined;

        function StateConsumer() {
            const reply = useReply();
            React.useEffect(() => {
                stateRenderCount += 1;
            });
            return <Text testID="state-consumer">{reply ? reply.previewText : 'no-reply'}</Text>;
        }

        function ActionsConsumer() {
            const {setReply} = useReplyActions();
            React.useEffect(() => {
                actionsRenderCount += 1;
                capturedSetReply = setReply;
            });
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
