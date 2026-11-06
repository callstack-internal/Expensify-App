/**
 * Measures what the report attributes cost the LHN: its mount, and the writes that make them recompute. It runs
 * unchanged on a leg that reads REPORT_ATTRIBUTES from the derived value and on one that reads it through
 * useOnyxState, so the two can be compared.
 */
import {render, screen} from '@testing-library/react-native';

import {setHasRadio} from '@libs/NetworkState';

import CONST from '@src/CONST';
import IntlStore from '@src/languages/IntlStore';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportCollectionDataSet} from '@src/types/onyx/Report';

import Onyx from 'react-native-onyx';
import {measureAsyncFunction, measureRenders} from 'reassure';

import * as LHNTestUtils from '../utils/LHNTestUtils';
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
jest.mock('../../src/libs/Navigation/navigationRef', () => ({
    getState: () => ({
        routes: [{name: 'Report'}],
    }),
    getRootState: () => ({
        routes: [],
    }),
    addListener: () => () => {},
    isReady: () => true,
}));

jest.mock('@react-navigation/native');

const WRITES_PER_SCENARIO = 10;
const PARTICIPANT_ACCOUNT_ID = 2;
const UNRELATED_TRANSACTION_ID = '888888';

function buildReports(count: number): ReportCollectionDataSet {
    return Object.fromEntries(
        Array.from({length: count}, (_, index) => {
            const report = {
                ...LHNTestUtils.getFakeReport([1, PARTICIPANT_ACCOUNT_ID], 1, true),
                lastMessageText: 'hey',
                lastVisibleActionCreated: `2025-01-01 00:00:${String(index % 60).padStart(2, '0')}.${String(index % 1000).padStart(3, '0')}`,
            };
            return [`${ONYXKEYS.COLLECTION.REPORT}${report.reportID}`, report];
        }),
    );
}

describe.each([500, 5000])('Report attributes in the LHN with %i reports', (reportCount) => {
    const reports = buildReports(reportCount);
    const visibleReportID = Object.values(reports).at(-1)?.reportID;
    const visibleReportKey = `${ONYXKEYS.COLLECTION.REPORT}${visibleReportID}` as const;
    const visibleReportActionsKey = `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${visibleReportID}` as const;

    beforeAll(async () => {
        Onyx.init({
            keys: ONYXKEYS,
            evictableKeys: [ONYXKEYS.COLLECTION.REPORT_ACTIONS],
        });
        // Required lazily so LHNTestUtils registers its @react-navigation/native mock before the engine's imports load it
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        require('@userActions/OnyxDerived').default();
        await IntlStore.load(CONST.LOCALES.EN);
    });

    beforeEach(async () => {
        global.fetch = TestHelper.getGlobalFetchMock();
        wrapOnyxWithWaitForBatchedUpdates(Onyx);
        setHasRadio(true);
        await TestHelper.signInWithTestUser(1, 'email1@test.com', undefined, undefined, 'One');
        await waitForBatchedUpdates();

        // Given many DMs with the same participant and translations that finished loading
        await Onyx.multiSet({
            [ONYXKEYS.PERSONAL_DETAILS_LIST]: LHNTestUtils.fakePersonalDetails,
            [ONYXKEYS.BETAS]: [CONST.BETAS.DEFAULT_ROOMS],
            [ONYXKEYS.NVP_PRIORITY_MODE]: CONST.PRIORITY_MODE.DEFAULT,
            [ONYXKEYS.IS_LOADING_REPORT_DATA]: false,
            [ONYXKEYS.RAM_ONLY_ARE_TRANSLATIONS_LOADING]: false,
            ...reports,
        });
        await waitForBatchedUpdates();
    });

    afterEach(async () => {
        await Onyx.clear();
        await IntlStore.load(CONST.LOCALES.EN);
        await waitForBatchedUpdates();
    });

    test('should mount the LHN', async () => {
        // When the LHN mounts, which is where report attributes are first read after startup
        const scenario = async () => {
            await screen.findByTestId('lhn-options-list');
        };

        // Then reassure measures the mount
        await measureRenders(<LHNTestUtils.MockedSidebarLinks />, {scenario});
    });

    test('should count LHN renders when a visible report changes', async () => {
        let run = 0;
        const scenario = async () => {
            await screen.findByTestId('lhn-options-list');

            // When a visible report gets a field update that does not change the order
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                await Onyx.merge(visibleReportKey, {lastMessageText: `hey ${run}-${index}`});
                await waitForBatchedUpdates();
            }
            run++;
        };

        // Then reassure counts how often the LHN renders for those writes
        await measureRenders(<LHNTestUtils.MockedSidebarLinks />, {scenario});
    });

    test('should take wall time to write one visible report', async () => {
        render(<LHNTestUtils.MockedSidebarLinks />);
        await screen.findByTestId('lhn-options-list');
        let run = 0;

        // When a visible report gets a field update, the attributes recompute that one report
        await measureAsyncFunction(async () => {
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                await Onyx.merge(visibleReportKey, {lastMessageText: `hey ${run}-${index}`});
                await waitForBatchedUpdates();
            }
            run++;
        });
    });

    test('should take wall time to add a comment to a visible report', async () => {
        render(<LHNTestUtils.MockedSidebarLinks />);
        await screen.findByTestId('lhn-options-list');
        let run = 0;

        // When comments land in a visible report
        await measureAsyncFunction(async () => {
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                const reportActionID = `${run}0${index}`;
                await Onyx.merge(visibleReportActionsKey, {
                    [reportActionID]: {
                        reportActionID,
                        actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
                        actorAccountID: PARTICIPANT_ACCOUNT_ID,
                        created: `2025-02-01 00:00:00.${String(index).padStart(3, '0')}`,
                        message: [{type: 'COMMENT', html: 'hi', text: 'hi'}],
                    },
                });
                await waitForBatchedUpdates();
            }
            run++;
        });
    });

    test('should take wall time to rename the participant of every report', async () => {
        render(<LHNTestUtils.MockedSidebarLinks />);
        await screen.findByTestId('lhn-options-list');
        let run = 0;

        // When the person in every DM changes their display name, every report name is recomputed
        await measureAsyncFunction(async () => {
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {[PARTICIPANT_ACCOUNT_ID]: {displayName: `Two ${run}-${index}`}});
                await waitForBatchedUpdates();
            }
            run++;
        });
    });

    test('should take wall time to write a violation on an expense outside the list', async () => {
        render(<LHNTestUtils.MockedSidebarLinks />);
        await screen.findByTestId('lhn-options-list');

        // When a violation lands on an expense no listed report holds, the attributes have nothing to recompute
        await measureAsyncFunction(async () => {
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                await Onyx.set(`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${UNRELATED_TRANSACTION_ID}`, [
                    {name: CONST.VIOLATIONS.MISSING_CATEGORY, type: CONST.VIOLATION_TYPES.VIOLATION, showInReview: index % 2 === 0},
                ]);
                await waitForBatchedUpdates();
            }
        });
    });

    test('should take wall time to switch the locale', async () => {
        render(<LHNTestUtils.MockedSidebarLinks />);
        await screen.findByTestId('lhn-options-list');

        // When the user switches language twice, every report name is recomputed each time
        await measureAsyncFunction(async () => {
            await IntlStore.load(CONST.LOCALES.ES);
            await waitForBatchedUpdates();
            await IntlStore.load(CONST.LOCALES.EN);
            await waitForBatchedUpdates();
        });
    });
});
