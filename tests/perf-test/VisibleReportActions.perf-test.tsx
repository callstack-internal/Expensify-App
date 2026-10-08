import {render, screen} from '@testing-library/react-native';

import ComposeProviders from '@components/ComposeProviders';
import OptionRowLHNData from '@components/LHNOptionsList/OptionRowLHN/OptionRowLHNData';
import {LocaleContextProvider} from '@components/LocaleContextProvider';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import SearchRouterOptionsWarmer from '@components/Search/SearchRouter/SearchRouterOptionsWarmer';

import {setHasRadio} from '@libs/NetworkState';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, ReportAction, ReportActions} from '@src/types/onyx';

import React from 'react';
import {View} from 'react-native';
import Onyx from 'react-native-onyx';
import {measureAsyncFunction, measureRenders} from 'reassure';

import * as LHNTestUtils from '../utils/LHNTestUtils';
import {getFakeReportAction} from '../utils/ReportTestUtils';
import * as TestHelper from '../utils/TestHelper';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';
import wrapOnyxWithWaitForBatchedUpdates from '../utils/wrapOnyxWithWaitForBatchedUpdates';

jest.mock('@libs/Permissions');
jest.mock('../../src/libs/Navigation/Navigation', () => ({
    navigate: jest.fn(),
    isActiveRoute: jest.fn(),
    getTopmostReportId: jest.fn(),
    getActiveRoute: jest.fn(),
    getTopmostReportActionId: jest.fn(),
    isNavigationReady: jest.fn(() => Promise.resolve()),
    isDisplayedInModal: jest.fn(() => false),
    getActiveRouteWithoutParams: jest.fn(() => ''),
}));

// The warmer builds the whole option list once its inputs hold still; never building keeps the measurement on its subscriptions
jest.mock('@libs/Scheduler', () => ({
    Scheduler: {scheduleWhenIdle: () => ({cancel: () => {}})},
}));

const ROW_COUNT = 50;
const ROWS_WITH_TRANSACTION_THREAD = 10;
const ACTIONS_PER_REPORT = 5;
const LARGE_EXTRA_REPORT_COUNT = 2000;
const WRITES_PER_SCENARIO = 10;
const FIRST_THREAD_REPORT_ID = 10000;
const FIRST_EXTRA_REPORT_ID = 20000;
const UNRELATED_REPORT_ID = '99999';
const ROW_REPORT_ID = '1';

function buildReportActions(reportID: string): ReportActions {
    const actions: ReportActions = {};
    for (let index = 0; index < ACTIONS_PER_REPORT; index++) {
        const reportActionID = `${reportID}00${index}`;
        actions[reportActionID] = getFakeReportAction(index, {
            reportActionID,
            reportID,
            actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
            created: `2025-01-01 00:00:0${index}.000`,
        });
    }
    return actions;
}

function buildComment(reportID: string, reportActionID: string): ReportAction {
    return getFakeReportAction(1, {reportActionID, reportID, actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT, created: '2025-06-01 00:00:00.000'});
}

const rowReports: Report[] = Array.from({length: ROW_COUNT}, (value, index) => ({...LHNTestUtils.getFakeReport([1, 2]), reportID: String(index + 1), lastMessageText: 'hey'}));
const threadReports: Report[] = Array.from({length: ROWS_WITH_TRANSACTION_THREAD}, (value, index) => ({
    ...LHNTestUtils.getFakeReport([1, 2]),
    reportID: String(FIRST_THREAD_REPORT_ID + index),
}));

const smallReportActions: Record<string, ReportActions> = {};
for (const report of [...rowReports, ...threadReports]) {
    smallReportActions[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.reportID}`] = buildReportActions(report.reportID);
}
smallReportActions[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${UNRELATED_REPORT_ID}`] = buildReportActions(UNRELATED_REPORT_ID);

const largeReportActions: Record<string, ReportActions> = {...smallReportActions};
for (let index = 0; index < LARGE_EXTRA_REPORT_COUNT; index++) {
    const reportID = String(FIRST_EXTRA_REPORT_ID + index);
    largeReportActions[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`] = buildReportActions(reportID);
}

/** Passed as the reassure wrapper so the providers sit outside the profiler and render counts are the rows' own */
function Providers({children}: {children: React.ReactNode}) {
    return <ComposeProviders components={[OnyxListItemProvider, LocaleContextProvider]}>{children}</ComposeProviders>;
}

/** LHN rows with fixed props, so the report attributes that every report action write recomputes can't re-render them through the list */
function LHNRows() {
    return (
        <View testID="lhn-rows">
            {rowReports.map((report, index) => (
                <OptionRowLHNData
                    key={report.reportID}
                    reportID={report.reportID}
                    fullReport={report}
                    oneTransactionThreadReport={index < ROWS_WITH_TRANSACTION_THREAD ? threadReports.at(index) : undefined}
                    personalDetails={LHNTestUtils.fakePersonalDetails}
                    reportAttributes={undefined}
                    testID={index}
                />
            ))}
        </View>
    );
}

/** The Search router's warmer reads the visibility of every report, as the other Search surfaces do */
function SearchConsumer() {
    return (
        <View testID="search-consumer">
            <SearchRouterOptionsWarmer onDone={() => {}} />
        </View>
    );
}

async function seed(reportActions: Record<string, ReportActions>) {
    await Onyx.multiSet({
        [ONYXKEYS.PERSONAL_DETAILS_LIST]: LHNTestUtils.fakePersonalDetails,
        [ONYXKEYS.IS_LOADING_REPORT_DATA]: false,
        ...Object.fromEntries([...rowReports, ...threadReports].map((report) => [`${ONYXKEYS.COLLECTION.REPORT}${report.reportID}`, report])),
        ...reportActions,
    });
    await waitForBatchedUpdates();
}

async function addComments(reportID: string, label: string) {
    for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
        const reportActionID = `${label}-${index}`;
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`, {[reportActionID]: buildComment(reportID, reportActionID)});
        await waitForBatchedUpdates();
    }
}

describe('Visible report actions consumers on report action writes', () => {
    beforeAll(() => {
        Onyx.init({
            keys: ONYXKEYS,
            evictableKeys: [ONYXKEYS.COLLECTION.REPORT_ACTIONS],
        });
        // Required lazily so LHNTestUtils registers its @react-navigation/native mock before the engine's imports load it
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        require('@userActions/OnyxDerived').default();
    });

    beforeEach(async () => {
        global.fetch = TestHelper.getGlobalFetchMock();
        wrapOnyxWithWaitForBatchedUpdates(Onyx);
        setHasRadio(true);
        await TestHelper.signInWithTestUser(1, 'email1@test.com', undefined, undefined, 'One');
        await waitForBatchedUpdates();
    });

    afterEach(async () => {
        await Onyx.clear();
        await waitForBatchedUpdates();
    });

    test('[VisibleReportActions] should not re-render 50 LHN rows when comments are added to a report without a row', async () => {
        // Given 50 LHN rows, 10 of them with a transaction thread
        await seed(smallReportActions);

        // Reassure runs the scenario several times against one seeded Onyx, so every run adds actions that don't exist yet
        let run = 0;
        const scenario = async () => {
            await screen.findByTestId('lhn-rows');

            // When comments are added to a report that has no row
            await addComments(UNRELATED_REPORT_ID, `unrelated-${run}`);
            run++;
        };

        // Then reassure measures what the writes cost rows that don't show that report
        await measureRenders(<LHNRows />, {scenario, wrapper: Providers});
    });

    test('[VisibleReportActions] should re-render only the LHN row whose report gets comments', async () => {
        // Given 50 LHN rows
        await seed(smallReportActions);

        let run = 0;
        const scenario = async () => {
            await screen.findByTestId('lhn-rows');

            // When comments are added to the first row's report, which changes its last visible action
            await addComments(ROW_REPORT_ID, `row-${run}`);
            run++;
        };

        // Then reassure measures the cost of a real change, which both versions have to pay for that one row
        await measureRenders(<LHNRows />, {scenario, wrapper: Providers});
    });

    test('[VisibleReportActions] should not re-render 50 LHN rows when comments are added to a report without a row in a large collection', async () => {
        // Given the same rows, with 2000 more reports holding actions
        await seed(largeReportActions);

        let run = 0;
        const scenario = async () => {
            await screen.findByTestId('lhn-rows');

            // When comments are added to a report that has no row
            await addComments(UNRELATED_REPORT_ID, `large-${run}`);
            run++;
        };

        // Then reassure measures the render cost, which grows if a row's selector walks the whole visibility map
        await measureRenders(<LHNRows />, {scenario, wrapper: Providers});
    });

    test('[VisibleReportActions] should re-render the Search consumer when comments are added in a large collection', async () => {
        // Given the Search router's warmer mounted over 2050 reports with actions
        await seed(largeReportActions);

        let run = 0;
        const scenario = async () => {
            await screen.findByTestId('search-consumer');

            // When comments are added to one report
            await addComments(UNRELATED_REPORT_ID, `search-${run}`);
            run++;
        };

        // Then reassure measures what a consumer of every report's visibility pays per write
        await measureRenders(<SearchConsumer />, {scenario, wrapper: Providers});
    });

    test('[VisibleReportActions] should process comment writes with only LHN rows mounted in a large collection', async () => {
        // Given the LHN rows mounted over 2050 reports with actions, and no consumer of every report's visibility
        await seed(largeReportActions);
        render(
            <Providers>
                <LHNRows />
            </Providers>,
        );
        await screen.findByTestId('lhn-rows');

        // When comments are added to a report without a row repeatedly
        let run = 0;
        const writeComments = async () => {
            await addComments(UNRELATED_REPORT_ID, `timed-lhn-${run}`);
            run++;
        };

        // Then reassure times the whole write loop, including the derived compute and its write to Onyx and storage, which happen outside renders
        await measureAsyncFunction(writeComments);
    });

    test('[VisibleReportActions] should process comment writes with the Search consumer mounted in a large collection', async () => {
        // Given the Search router's warmer mounted over 2050 reports with actions
        await seed(largeReportActions);
        render(
            <Providers>
                <SearchConsumer />
            </Providers>,
        );
        await screen.findByTestId('search-consumer');

        // When comments are added to one report repeatedly
        let run = 0;
        const writeComments = async () => {
            await addComments(UNRELATED_REPORT_ID, `timed-search-${run}`);
            run++;
        };

        // Then reassure times the whole write loop, where every write rebuilds the map of every report's visibility
        await measureAsyncFunction(writeComments);
    });

    test('[VisibleReportActions] should process comment writes with no consumer mounted in a large collection', async () => {
        // Given 2050 reports with actions and nothing mounted that reads their visibility
        await seed(largeReportActions);

        // When comments are added to one report repeatedly
        let run = 0;
        const writeComments = async () => {
            await addComments(UNRELATED_REPORT_ID, `timed-idle-${run}`);
            run++;
        };

        // Then reassure times the write loop alone, so any work done for the visibility without a reader shows up
        await measureAsyncFunction(writeComments);
    });
});
