import {render, screen} from '@testing-library/react-native';
import React from 'react';
import Onyx from 'react-native-onyx';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import ReportKindDispatcher from '@components/report/ReportKindDispatcher';
import Text from '@components/Text';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

jest.mock('@libs/actions/Report', () => {
    const actual = jest.requireActual<Record<string, unknown>>('@libs/actions/Report');
    return {
        ...actual,
        openReport: jest.fn(),
    };
});

jest.mock('@components/report/TaskReport', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const ReactLocal = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    function TaskReportMock() {
        return ReactLocal.createElement(RN.Text, null, 'BRANCH:TASK');
    }
    TaskReportMock.displayName = 'TaskReportMock';
    return {
        __esModule: true,
        default: TaskReportMock,
    };
});

jest.mock('@components/report/TransactionThread', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const ReactLocal = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    function TransactionThreadMock() {
        return ReactLocal.createElement(RN.Text, null, 'BRANCH:TRANSACTION_THREAD');
    }
    TransactionThreadMock.displayName = 'TransactionThreadMock';
    return {
        __esModule: true,
        default: TransactionThreadMock,
    };
});

jest.mock('@components/report/ChatReport', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const ReactLocal = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    function ChatReportMock() {
        return ReactLocal.createElement(RN.Text, null, 'BRANCH:CHAT_REPORT');
    }
    ChatReportMock.displayName = 'ChatReportMock';
    return {
        __esModule: true,
        default: ChatReportMock,
    };
});

jest.mock('@components/report/ReportShellSkeleton', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const ReactLocal = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    function ReportShellSkeletonMock() {
        return ReactLocal.createElement(RN.Text, null, 'BRANCH:SKELETON');
    }
    ReportShellSkeletonMock.displayName = 'ReportShellSkeletonMock';
    return {
        __esModule: true,
        default: ReportShellSkeletonMock,
    };
});

const REPORT_ID = '1';
const PARENT_REPORT_ID = '2';

function Sentinel({label}: {label: string}) {
    return <Text>BRANCH:{label}</Text>;
}

function renderDispatcher() {
    return render(
        <OnyxListItemProvider>
            <ReportKindDispatcher
                reportID={REPORT_ID}
                fallthrough={<Sentinel label="FALLTHROUGH" />}
                slots={{
                    moneyRequestReport: <Sentinel label="MONEY_REQUEST_REPORT" />,
                    transactionThread: <Sentinel label="TRANSACTION_THREAD" />,
                    chatReport: <Sentinel label="CHAT_REPORT" />,
                }}
            />
        </OnyxListItemProvider>,
    );
}

async function setReport(report: Record<string, unknown>) {
    await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {reportID: REPORT_ID, ...report});
}

async function setParentReport(report: Record<string, unknown>) {
    await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${PARENT_REPORT_ID}`, {reportID: PARENT_REPORT_ID, ...report});
}

async function expectBranch(label: string) {
    await waitForBatchedUpdatesWithAct();
    expect(screen.getByText(`BRANCH:${label}`)).toBeTruthy();
}

describe('ReportKindDispatcher', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        await Onyx.clear();
    });

    it('renders the skeleton when the report record is null', async () => {
        renderDispatcher();
        await expectBranch('SKELETON');
    });

    it('routes type === TASK to the TaskReport compound', async () => {
        await setReport({type: CONST.REPORT.TYPE.TASK});
        renderDispatcher();
        await expectBranch('TASK');
    });

    it('routes a chat root to the chatReport branch (no parent, type CHAT)', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT});
        renderDispatcher();
        await expectBranch('CHAT_REPORT');
    });

    it('routes a multi-transaction money-request root to the moneyRequestReport branch', async () => {
        await setReport({type: CONST.REPORT.TYPE.EXPENSE, transactionCount: 2});
        renderDispatcher();
        await expectBranch('MONEY_REQUEST_REPORT');
    });

    it('routes a single-transaction money-request root to the transactionThread branch', async () => {
        await setReport({type: CONST.REPORT.TYPE.EXPENSE, transactionCount: 1});
        renderDispatcher();
        await expectBranch('TRANSACTION_THREAD');
    });

    it('routes a zero-transaction money-request root to the transactionThread branch', async () => {
        await setReport({type: CONST.REPORT.TYPE.IOU, transactionCount: 0});
        renderDispatcher();
        await expectBranch('TRANSACTION_THREAD');
    });

    it('routes a money-request root with undefined transactionCount via the `?? 0` default to the transactionThread branch', async () => {
        await setReport({type: CONST.REPORT.TYPE.INVOICE});
        renderDispatcher();
        await expectBranch('TRANSACTION_THREAD');
    });

    it('routes a thread on a money-request parent (IOU) to the transactionThread branch', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT, parentReportID: PARENT_REPORT_ID});
        await setParentReport({type: CONST.REPORT.TYPE.IOU});
        renderDispatcher();
        await expectBranch('TRANSACTION_THREAD');
    });

    it('routes a thread on an EXPENSE parent to the transactionThread branch', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT, parentReportID: PARENT_REPORT_ID});
        await setParentReport({type: CONST.REPORT.TYPE.EXPENSE});
        renderDispatcher();
        await expectBranch('TRANSACTION_THREAD');
    });

    it('routes a thread on an INVOICE parent to the transactionThread branch', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT, parentReportID: PARENT_REPORT_ID});
        await setParentReport({type: CONST.REPORT.TYPE.INVOICE});
        renderDispatcher();
        await expectBranch('TRANSACTION_THREAD');
    });

    it('routes a thread on a SELF_DM chat parent to the transactionThread branch', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT, parentReportID: PARENT_REPORT_ID});
        await setParentReport({type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.SELF_DM});
        renderDispatcher();
        await expectBranch('TRANSACTION_THREAD');
    });

    it('routes a chat thread on a chat parent to the chatReport branch', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT, parentReportID: PARENT_REPORT_ID});
        await setParentReport({type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.POLICY_ROOM});
        renderDispatcher();
        await expectBranch('CHAT_REPORT');
    });

    // Production-mode coverage: when no `slots` prop is passed, the dispatcher mounts
    // the real `TransactionThread` compound (mocked here to a sentinel) for every
    // transaction-thread shape. Mirrors the assertion shape of `routes type === TASK`
    // above — `BRANCH:TRANSACTION_THREAD` comes from the `TransactionThread` mock.
    function renderDispatcherProduction() {
        return render(
            <OnyxListItemProvider>
                <ReportKindDispatcher
                    reportID={REPORT_ID}
                    fallthrough={<Sentinel label="FALLTHROUGH" />}
                />
            </OnyxListItemProvider>,
        );
    }

    it('mounts the real TransactionThread compound for a thread on an IOU parent in production mode', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT, parentReportID: PARENT_REPORT_ID});
        await setParentReport({type: CONST.REPORT.TYPE.IOU});
        renderDispatcherProduction();
        await expectBranch('TRANSACTION_THREAD');
    });

    it('mounts the real TransactionThread compound for a thread on an EXPENSE parent in production mode', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT, parentReportID: PARENT_REPORT_ID});
        await setParentReport({type: CONST.REPORT.TYPE.EXPENSE});
        renderDispatcherProduction();
        await expectBranch('TRANSACTION_THREAD');
    });

    it('mounts the real TransactionThread compound for a thread on an INVOICE parent in production mode', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT, parentReportID: PARENT_REPORT_ID});
        await setParentReport({type: CONST.REPORT.TYPE.INVOICE});
        renderDispatcherProduction();
        await expectBranch('TRANSACTION_THREAD');
    });

    it('mounts the real TransactionThread compound for a thread on a SELF_DM chat parent in production mode', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT, parentReportID: PARENT_REPORT_ID});
        await setParentReport({type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.SELF_DM});
        renderDispatcherProduction();
        await expectBranch('TRANSACTION_THREAD');
    });

    it('mounts the real TransactionThread compound for a top-level single-tx IOU (transactionCount 1) in production mode', async () => {
        await setReport({type: CONST.REPORT.TYPE.IOU, transactionCount: 1});
        renderDispatcherProduction();
        await expectBranch('TRANSACTION_THREAD');
    });

    it('mounts the real TransactionThread compound for a top-level zero-tx EXPENSE (transactionCount 0) in production mode', async () => {
        await setReport({type: CONST.REPORT.TYPE.EXPENSE, transactionCount: 0});
        renderDispatcherProduction();
        await expectBranch('TRANSACTION_THREAD');
    });

    it('mounts the real TransactionThread compound for a top-level INVOICE with undefined transactionCount in production mode', async () => {
        await setReport({type: CONST.REPORT.TYPE.INVOICE});
        renderDispatcherProduction();
        await expectBranch('TRANSACTION_THREAD');
    });

    // Chat-report production-mode coverage: when no `slots` prop is passed, the
    // dispatcher mounts the real `ChatReport` compound (mocked here to a sentinel)
    // for every chat sub-kind. Mirrors the assertion shape of the
    // `mounts the real TransactionThread compound...` cases above.
    it('mounts the real ChatReport compound for a top-level CHAT (DM) in production mode', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT});
        renderDispatcherProduction();
        await expectBranch('CHAT_REPORT');
    });

    it('mounts the real ChatReport compound for a top-level group chat in production mode', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.GROUP});
        renderDispatcherProduction();
        await expectBranch('CHAT_REPORT');
    });

    it('mounts the real ChatReport compound for a top-level self-DM in production mode', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.SELF_DM});
        renderDispatcherProduction();
        await expectBranch('CHAT_REPORT');
    });

    it('mounts the real ChatReport compound for a top-level admin room in production mode', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.POLICY_ADMINS});
        renderDispatcherProduction();
        await expectBranch('CHAT_REPORT');
    });

    it('mounts the real ChatReport compound for a top-level announce room in production mode', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.POLICY_ANNOUNCE});
        renderDispatcherProduction();
        await expectBranch('CHAT_REPORT');
    });

    it('mounts the real ChatReport compound for a top-level user-created policy room in production mode', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.POLICY_ROOM});
        renderDispatcherProduction();
        await expectBranch('CHAT_REPORT');
    });

    it('mounts the real ChatReport compound for a top-level policy expense chat in production mode', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT});
        renderDispatcherProduction();
        await expectBranch('CHAT_REPORT');
    });

    it('mounts the real ChatReport compound for a chat thread on a chat parent in production mode', async () => {
        await setReport({type: CONST.REPORT.TYPE.CHAT, parentReportID: PARENT_REPORT_ID});
        await setParentReport({type: CONST.REPORT.TYPE.CHAT, chatType: CONST.REPORT.CHAT_TYPE.POLICY_ROOM});
        renderDispatcherProduction();
        await expectBranch('CHAT_REPORT');
    });

    it('does not subscribe to a real parent report when parentReportID is null (top-level reports)', async () => {
        const connectSpy = jest.spyOn(Onyx, 'connect');
        await setReport({type: CONST.REPORT.TYPE.CHAT});
        // Pre-populate a real parent key. If the dispatcher subscribed to a real parent
        // for this top-level report, the spy would record a connect against this key.
        await setParentReport({type: CONST.REPORT.TYPE.IOU});

        renderDispatcher();
        await waitForBatchedUpdatesWithAct();

        const connectedToRealParent = connectSpy.mock.calls.some((call) => {
            const arg = call[0] as {key?: string};
            return typeof arg?.key === 'string' && arg.key === `${ONYXKEYS.COLLECTION.REPORT}${PARENT_REPORT_ID}`;
        });
        expect(connectedToRealParent).toBe(false);
        connectSpy.mockRestore();
    });
});
