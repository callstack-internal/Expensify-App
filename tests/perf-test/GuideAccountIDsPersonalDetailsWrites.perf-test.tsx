import {render, screen} from '@testing-library/react-native';

import {setHasRadio} from '@libs/NetworkState';

import withReportOrNotFound from '@pages/inbox/report/withReportOrNotFound';
import type {WithReportOrNotFoundProps} from '@pages/inbox/report/withReportOrNotFound';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {PersonalDetailsList} from '@src/types/onyx';

import type * as Navigation from '@react-navigation/native';

import React from 'react';
import {View} from 'react-native';
import Onyx from 'react-native-onyx';
import {measureAsyncFunction, measureRenders} from 'reassure';

import createMock from '../utils/createMock';
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

// Declared here rather than relying on LHNTestUtils, because withReportOrNotFound loads @react-navigation/native before LHNTestUtils does
jest.mock('@react-navigation/native', () => {
    const actualNav = jest.requireActual<typeof Navigation>('@react-navigation/native');
    return {
        ...actualNav,
        useNavigationState: () => true,
        useRoute: jest.fn(),
        useFocusEffect: jest.fn(),
        useIsFocused: () => true,
        useNavigation: () => ({
            navigate: jest.fn(),
            addListener: jest.fn(),
        }),
        createNavigationContainerRef: jest.fn(),
    };
});

const REPORT_COUNT = 500;
const REPORT_SCREEN_COUNT = 4;
const LARGE_PERSONAL_DETAILS_COUNT = 5000;
const WRITES_PER_SCENARIO = 10;
const GUIDE_ACCOUNT_ID = 50;
const UNRELATED_ACCOUNT_ID = 60;
const FIRST_EXTRA_ACCOUNT_ID = 1000;
const FIRST_JOINING_GUIDE_ACCOUNT_ID = 100000;

const reports = Object.fromEntries(
    Array.from({length: REPORT_COUNT}, (value, index) => {
        const reportID = String(index + 1);
        const report = {...LHNTestUtils.getFakeReport([1, 2], 1, true), reportID, lastMessageText: 'hey'};
        return [`${ONYXKEYS.COLLECTION.REPORT}${reportID}`, report];
    }),
);

const smallPersonalDetails: PersonalDetailsList = {
    ...LHNTestUtils.fakePersonalDetails,
    [GUIDE_ACCOUNT_ID]: {accountID: GUIDE_ACCOUNT_ID, login: `guide@${CONST.EMAIL.GUIDES_DOMAIN}`, displayName: 'Guide'},
    [UNRELATED_ACCOUNT_ID]: {accountID: UNRELATED_ACCOUNT_ID, login: 'unrelated@test.com', displayName: 'Unrelated'},
};

const largePersonalDetails: PersonalDetailsList = {
    ...smallPersonalDetails,
    ...Object.fromEntries(
        Array.from({length: LARGE_PERSONAL_DETAILS_COUNT}, (value, index) => {
            const accountID = FIRST_EXTRA_ACCOUNT_ID + index;
            return [accountID, {accountID, login: `user${accountID}@test.com`, displayName: `User ${accountID}`}];
        }),
    ),
};

function ReportScreenContent({route}: WithReportOrNotFoundProps) {
    return <View testID={`report-screen-${'reportID' in route.params ? route.params.reportID : ''}`} />;
}

const ReportScreen = withReportOrNotFound()(ReportScreenContent);

// The HOC overwrites the report props with what it reads from Onyx, so these placeholders are never used
const injectedPropsMock = createMock<Omit<WithReportOrNotFoundProps, 'route' | 'navigation'>>({});

const navigationMock = createMock<WithReportOrNotFoundProps['navigation']>({});

/** Report screens read the guide accountIDs but not the report attributes, so their re-renders isolate guide churn */
function ReportScreens() {
    return (
        <>
            {Array.from({length: REPORT_SCREEN_COUNT}, (value, index) => (
                <ReportScreen
                    key={index}
                    {...injectedPropsMock}
                    route={createMock<WithReportOrNotFoundProps['route']>({params: {reportID: String(index + 1)}})}
                    navigation={navigationMock}
                />
            ))}
        </>
    );
}

/** The LHN plus a few report screens, the guide accountIDs consumers that are mounted together in a normal session */
function GuideConsumers() {
    return (
        <>
            <LHNTestUtils.MockedSidebarLinks />
            <ReportScreens />
        </>
    );
}

async function seed(personalDetails: PersonalDetailsList) {
    await Onyx.multiSet({
        [ONYXKEYS.PERSONAL_DETAILS_LIST]: personalDetails,
        [ONYXKEYS.BETAS]: [CONST.BETAS.DEFAULT_ROOMS],
        [ONYXKEYS.NVP_PRIORITY_MODE]: CONST.PRIORITY_MODE.GSD,
        [ONYXKEYS.IS_LOADING_REPORT_DATA]: false,
        ...reports,
    });
    await waitForBatchedUpdates();
}

describe('Guide accountIDs consumers on personal details writes', () => {
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

    test('[GuideAccountIDs] should re-render when a non-guide user is renamed', async () => {
        // Given the LHN and four report screens, with a guide and a user who is in none of the reports
        await seed(smallPersonalDetails);

        // Reassure runs the scenario several times against one seeded Onyx, so every run writes a name that doesn't exist yet
        let run = 0;
        const scenario = async () => {
            await screen.findByTestId('lhn-options-list');

            // When that user is renamed repeatedly, which leaves the set of guides unchanged
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {[UNRELATED_ACCOUNT_ID]: {displayName: `Unrelated ${run}-${index}`}});
                await waitForBatchedUpdates();
            }
            run++;
        };

        // Then reassure measures what the unrelated writes cost the consumers
        await measureRenders(<GuideConsumers />, {scenario});
    });

    test('[GuideAccountIDs] should not re-render report screens when a non-guide user is renamed', async () => {
        // Given only the report screens, which subscribe to the guide accountIDs but not to the report attributes
        await seed(smallPersonalDetails);

        let run = 0;
        const scenario = async () => {
            await screen.findAllByTestId(/report-screen-/);

            // When a non-guide user is renamed repeatedly, which leaves the set of guides unchanged
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {[UNRELATED_ACCOUNT_ID]: {displayName: `Unrelated isolated ${run}-${index}`}});
                await waitForBatchedUpdates();
            }
            run++;
        };

        // Then every extra render here comes from the guide accountIDs changing reference without changing content
        await measureRenders(<ReportScreens />, {scenario});
    });

    test('[GuideAccountIDs] should re-render when a non-guide user is renamed in a large personal details list', async () => {
        // Given the same screens, with 5000 more people in the personal details list
        await seed(largePersonalDetails);

        let run = 0;
        const scenario = async () => {
            await screen.findByTestId('lhn-options-list');

            // When a non-guide user is renamed repeatedly, so every write re-scans the whole list for guides
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {[UNRELATED_ACCOUNT_ID]: {displayName: `Unrelated ${run}-${index}`}});
                await waitForBatchedUpdates();
            }
            run++;
        };

        // Then reassure measures the render cost, which grows if each consumer re-scans the list during render
        await measureRenders(<GuideConsumers />, {scenario});
    });

    test('[GuideAccountIDs] should re-render when a new guide joins', async () => {
        // Given the LHN and four report screens
        await seed(smallPersonalDetails);

        let nextGuideAccountID = FIRST_JOINING_GUIDE_ACCOUNT_ID;
        const scenario = async () => {
            await screen.findByTestId('lhn-options-list');

            // When a new guide appears on every write, so the set of guides really changes and the LHN must re-scan
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                const accountID = nextGuideAccountID++;
                await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {[accountID]: {accountID, login: `guide${accountID}@${CONST.EMAIL.GUIDES_DOMAIN}`}});
                await waitForBatchedUpdates();
            }
        };

        // Then reassure measures the cost of a real guide change, which both versions have to pay
        await measureRenders(<GuideConsumers />, {scenario});
    });

    test('[GuideAccountIDs] should process non-guide renames in a large personal details list', async () => {
        // Given the screens mounted over the large personal details list
        await seed(largePersonalDetails);
        render(<GuideConsumers />);
        await screen.findByTestId('lhn-options-list');

        // When a non-guide user is renamed repeatedly
        let run = 0;
        const writeRenames = async () => {
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {[UNRELATED_ACCOUNT_ID]: {displayName: `Unrelated timed ${run}-${index}`}});
                await waitForBatchedUpdates();
            }
            run++;
        };

        // Then reassure times the whole write loop, including work done outside React renders such as derived computes and their writes
        await measureAsyncFunction(writeRenames);
    });
});
