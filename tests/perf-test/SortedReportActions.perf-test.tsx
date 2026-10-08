import {render, screen} from '@testing-library/react-native';

import {LocaleContextProvider} from '@components/LocaleContextProvider';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import SearchRouter from '@components/Search/SearchRouter/SearchRouter';

import useSortedReportActionsData from '@hooks/useSortedReportActionsData';

import {setHasRadio} from '@libs/NetworkState';

import ComposeProviders from '@src/components/ComposeProviders';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, ReportAction} from '@src/types/onyx';
import type {ReportCollectionDataSet} from '@src/types/onyx/Report';
import type {ReportActionsCollectionDataSet} from '@src/types/onyx/ReportAction';

import type * as NativeNavigation from '@react-navigation/native';

import React from 'react';
import {View} from 'react-native';
import Onyx from 'react-native-onyx';
import {measureAsyncFunction, measureRenders} from 'reassure';

import createMock from '../utils/createMock';
import * as TestHelper from '../utils/TestHelper';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';
import wrapOnyxWithWaitForBatchedUpdates from '../utils/wrapOnyxWithWaitForBatchedUpdates';

jest.mock('lodash/debounce', () =>
    jest.fn((fn: Record<string, jest.Mock>) => {
        // eslint-disable-next-line no-param-reassign
        fn.cancel = jest.fn();
        return fn;
    }),
);

jest.mock('@src/libs/Log');

jest.mock('@src/libs/API', () => ({
    write: jest.fn(),
    makeRequestWithSideEffects: jest.fn(),
    read: jest.fn(),
}));

jest.mock('@src/libs/Navigation/Navigation', () => ({
    dismissModalWithReport: jest.fn(),
    getTopmostReportId: jest.fn(),
    isNavigationReady: jest.fn(() => Promise.resolve()),
    isDisplayedInModal: jest.fn(() => false),
    getActiveRouteWithoutParams: jest.fn(() => ''),
}));

jest.mock('@src/hooks/useRootNavigationState', () => ({
    __esModule: true,
    default: () => ({
        contextualReportID: undefined,
        isSearchRouterScreen: false,
    }),
}));

jest.mock('@hooks/useExportedToFilterOptions', () => ({
    __esModule: true,
    default: () => ({
        exportedToFilterOptions: [],
        connectedIntegrationNames: new Set<string>(),
    }),
}));

jest.mock('@react-navigation/native', () => {
    const actualNav = jest.requireActual<typeof NativeNavigation>('@react-navigation/native');
    return {
        ...actualNav,
        useFocusEffect: jest.fn(),
        useIsFocused: () => true,
        useRoute: () => jest.fn(),
        usePreventRemove: () => jest.fn(),
        useNavigation: () => ({
            navigate: jest.fn(),
            addListener: () => jest.fn(),
        }),
        createNavigationContainerRef: () => ({
            addListener: () => jest.fn(),
            removeListener: () => jest.fn(),
            isReady: () => jest.fn(),
            getCurrentRoute: () => jest.fn(),
            getState: () => jest.fn(),
            getRootState: () => undefined,
        }),
        useNavigationState: () => ({
            routes: [],
        }),
    };
});

jest.mock('@src/components/ConfirmedRoute.tsx');

const CURRENT_USER_ACCOUNT_ID = 1;
const LARGE_REPORT_COUNT = 3000;
const ACTIONS_PER_REPORT = 10;
const EXPENSE_REPORT_EVERY = 10;
const THREAD_REPORT_ID_OFFSET = 100000;
const FUNNEL_CONSUMER_COUNT = 4;
const WRITES_PER_SCENARIO = 10;

let networkWriteCount = 0;

function createComment(reportID: number, index: number, label: string): ReportAction {
    return createMock<ReportAction>({
        reportActionID: `${reportID}${label}${index}`,
        actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
        actorAccountID: 1,
        created: `2024-01-01 10:${String(index % 60).padStart(2, '0')}:${String(reportID % 60).padStart(2, '0')}.000`,
        message: [{type: 'COMMENT', html: `Comment ${index}`, text: `Comment ${index}`}],
    });
}

/**
 * Chats with comments, and every tenth report a one-transaction expense report whose IOU action points at a thread
 * with comments, so the per-report compute also resolves and combines transaction threads.
 * A new label gives every action a new object and ID, so nothing is reused from an earlier build.
 */
function buildData(reportCount: number, label = '') {
    const reports: ReportCollectionDataSet = {};
    const reportActions: ReportActionsCollectionDataSet = {};
    for (let reportID = 1; reportID <= reportCount; reportID++) {
        const actions: Record<string, ReportAction> = {};
        for (let index = 0; index < ACTIONS_PER_REPORT; index++) {
            const action = createComment(reportID, index, label);
            actions[action.reportActionID] = action;
        }

        const isExpenseReport = reportID % EXPENSE_REPORT_EVERY === 0;
        if (isExpenseReport) {
            const threadReportID = THREAD_REPORT_ID_OFFSET + reportID;
            const iouAction = createMock<ReportAction>({
                reportActionID: `${reportID}${label}iou`,
                actionName: CONST.REPORT.ACTIONS.TYPE.IOU,
                actorAccountID: 1,
                childReportID: String(threadReportID),
                created: '2024-01-01 09:00:00.000',
                message: [{type: 'COMMENT', html: '$1.00 expense', text: '$1.00 expense'}],
                originalMessage: {IOUTransactionID: `txn${reportID}`, IOUReportID: String(reportID), type: CONST.IOU.REPORT_ACTION_TYPE.CREATE, amount: 100, currency: 'USD'},
            });
            actions[iouAction.reportActionID] = iouAction;
            const threadComment = createComment(threadReportID, 0, label);
            reportActions[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${threadReportID}`] = {[threadComment.reportActionID]: threadComment};
        }

        reportActions[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`] = actions;
        reports[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`] = createMock<Report>({
            reportID: String(reportID),
            reportName: `Report ${reportID}`,
            type: isExpenseReport ? CONST.REPORT.TYPE.EXPENSE : CONST.REPORT.TYPE.CHAT,
            chatReportID: isExpenseReport ? String(reportID - 1) : undefined,
            ownerAccountID: 1,
            participants: {[CURRENT_USER_ACCOUNT_ID]: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS}},
            lastVisibleActionCreated: '2024-01-01 10:09:00.000',
            lastReadTime: '2024-01-01 10:00:00.000',
        });
    }
    return {reports, reportActions};
}

const largeData = buildData(LARGE_REPORT_COUNT);

async function seed() {
    await Onyx.multiSet({
        ...largeData.reports,
        ...largeData.reportActions,
        [ONYXKEYS.BETAS]: Object.values(CONST.BETAS),
        [ONYXKEYS.RAM_ONLY_IS_SEARCHING_FOR_REPORTS]: true,
    });
    await waitForBatchedUpdates();
}

/** A report field that has no effect on sorted actions, written with a new value every time */
async function writeReportReadTimes(label: string) {
    for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${index + 1}`, {lastReadTime: `2024-02-01 ${label}-${index}`});
        await waitForBatchedUpdates();
    }
}

/** A network field that leaves the offline state as it is */
async function writeNetworkTimeSkews() {
    for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
        networkWriteCount++;
        await Onyx.merge(ONYXKEYS.NETWORK, {timeSkew: networkWriteCount});
        await waitForBatchedUpdates();
    }
}

/** A new comment on one report per write, which really changes that report's sorted actions */
async function writeNewComments(label: string) {
    for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
        const reportID = index + 1;
        const comment = createComment(reportID, ACTIONS_PER_REPORT + index, label);
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`, {[comment.reportActionID]: comment});
        await waitForBatchedUpdates();
    }
}

/** One update touching all three inputs, as a server response often does */
async function writeMixedUpdates(label: string) {
    for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
        const reportID = index + 1;
        const comment = createComment(reportID, ACTIONS_PER_REPORT + index, `mixed${label}`);
        networkWriteCount++;
        await Onyx.update([
            {onyxMethod: Onyx.METHOD.MERGE, key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`, value: {[comment.reportActionID]: comment}},
            {onyxMethod: Onyx.METHOD.MERGE, key: `${ONYXKEYS.COLLECTION.REPORT}${reportID}`, value: {lastVisibleActionCreated: comment.created, lastReadTime: comment.created}},
            {onyxMethod: Onyx.METHOD.MERGE, key: ONYXKEYS.NETWORK, value: {timeSkew: networkWriteCount}},
        ]);
        await waitForBatchedUpdates();
    }
}

function SortedActionsConsumer() {
    useSortedReportActionsData();
    return <View testID="sorted-actions-consumer" />;
}

/** Several readers of the sorted actions and nothing else, as the Search router, its list and its option hooks are */
function SortedActionsConsumers() {
    return (
        <>
            {Array.from({length: FUNNEL_CONSUMER_COUNT}, (value, index) => (
                <SortedActionsConsumer key={index} />
            ))}
        </>
    );
}

function SearchRouterWrapper() {
    return (
        <ComposeProviders components={[OnyxListItemProvider, LocaleContextProvider]}>
            <SearchRouter onRouterClose={jest.fn()} />
        </ComposeProviders>
    );
}

describe('Sorted report actions consumers', () => {
    beforeAll(() => {
        Onyx.init({
            keys: ONYXKEYS,
            evictableKeys: [ONYXKEYS.COLLECTION.REPORT],
        });
        // Required lazily so the navigation mocks above are registered before the engine's imports load it
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        require('@userActions/OnyxDerived').default();
    });

    beforeEach(async () => {
        global.fetch = TestHelper.getGlobalFetchMock();
        wrapOnyxWithWaitForBatchedUpdates(Onyx);
        setHasRadio(true);
        await seed();
    });

    afterEach(async () => {
        await Onyx.clear();
        await waitForBatchedUpdates();
    });

    test('[SortedReportActions] should mount the Search router over a large report collection', async () => {
        // Given 3000 reports with 10 actions each already in Onyx
        const scenario = async () => {
            await screen.findByTestId('SearchRouter');
        };

        // When the router mounts, then reassure measures the mount, which now pays the sort the engine did in the background
        await measureRenders(<SearchRouterWrapper />, {scenario});
    });

    test('[SortedReportActions] should open the Search router after every report action changed', async () => {
        // Given 3000 reports with 10 actions each
        let run = 0;
        const openAfterFreshActions = async () => {
            // When every report gets new action objects and the router is opened right after
            await Onyx.multiSet(buildData(LARGE_REPORT_COUNT, `fresh${run}`).reportActions);
            await waitForBatchedUpdates();
            const {unmount} = render(<SearchRouterWrapper />);
            await screen.findByTestId('SearchRouter');
            unmount();
            run++;
        };

        // Then reassure times the write plus the open: the base sorts in the engine on the write, the branch on the mount
        await measureAsyncFunction(openAfterFreshActions);
    });

    test('[SortedReportActions] should re-render the Search router on report writes', async () => {
        // Given the router mounted over 3000 reports
        let run = 0;
        const scenario = async () => {
            await screen.findByTestId('SearchRouter');

            // When report fields that don't affect sorted actions change
            await writeReportReadTimes(`router${run}`);
            run++;
        };

        // Then reassure measures the renders, where the base re-sorted every report on each write
        await measureRenders(<SearchRouterWrapper />, {scenario});
    });

    test('[SortedReportActions] should re-render the Search router on network writes', async () => {
        // Given the router mounted over 3000 reports
        const scenario = async () => {
            await screen.findByTestId('SearchRouter');

            // When NETWORK changes without changing the offline state
            await writeNetworkTimeSkews();
        };

        // Then reassure measures the renders, where the base re-sorted every report on each write
        await measureRenders(<SearchRouterWrapper />, {scenario});
    });

    test('[SortedReportActions] should re-render sorted action readers on report writes', async () => {
        // Given only readers of the sorted actions, so other Search inputs don't add renders
        let run = 0;
        const scenario = async () => {
            await screen.findAllByTestId('sorted-actions-consumer');

            // When report fields that don't affect sorted actions change
            await writeReportReadTimes(`readers${run}`);
            run++;
        };

        // Then every render here comes from the sorted actions changing reference
        await measureRenders(<SortedActionsConsumers />, {scenario});
    });

    test('[SortedReportActions] should re-render sorted action readers on network writes', async () => {
        // Given only readers of the sorted actions
        const scenario = async () => {
            await screen.findAllByTestId('sorted-actions-consumer');

            // When NETWORK changes without changing the offline state
            await writeNetworkTimeSkews();
        };

        // Then every render here comes from the sorted actions changing reference
        await measureRenders(<SortedActionsConsumers />, {scenario});
    });

    test('[SortedReportActions] should re-render sorted action readers on new comments', async () => {
        // Given only readers of the sorted actions
        let run = 0;
        const scenario = async () => {
            await screen.findAllByTestId('sorted-actions-consumer');

            // When one report gets a new comment on every write, which both versions must deliver
            await writeNewComments(`readers${run}`);
            run++;
        };

        // Then reassure measures the cost of a real change
        await measureRenders(<SortedActionsConsumers />, {scenario});
    });

    test('[SortedReportActions] should process mixed updates with the Search router mounted', async () => {
        // Given the router mounted over 3000 reports
        render(<SearchRouterWrapper />);
        await screen.findByTestId('SearchRouter');

        // When updates touch report actions, the report and NETWORK at once
        let run = 0;
        const writeLoop = async () => {
            await writeMixedUpdates(`mounted${run}`);
            run++;
        };

        // Then reassure times the whole loop, including the engine's computes outside React renders
        await measureAsyncFunction(writeLoop);
    });

    test('[SortedReportActions] should process report and network writes with the Search router mounted', async () => {
        // Given the router mounted over 3000 reports
        render(<SearchRouterWrapper />);
        await screen.findByTestId('SearchRouter');

        // When report fields and NETWORK change without changing any sorted actions
        let run = 0;
        const writeLoop = async () => {
            await writeReportReadTimes(`mountedLoop${run}`);
            await writeNetworkTimeSkews();
            run++;
        };

        // Then reassure times the whole loop, including the engine's computes outside React renders
        await measureAsyncFunction(writeLoop);
    });

    test('[SortedReportActions] should process writes with no Search surface mounted', async () => {
        // Given 3000 reports in Onyx and nothing that reads sorted actions mounted, as during plain inbox use
        let run = 0;
        const writeLoop = async () => {
            // When report fields, NETWORK and report actions change
            await writeReportReadTimes(`unmounted${run}`);
            await writeNetworkTimeSkews();
            await writeNewComments(`unmounted${run}`);
            run++;
        };

        // Then reassure times the loop, where the base still sorted on every write
        await measureAsyncFunction(writeLoop);
    });
});
