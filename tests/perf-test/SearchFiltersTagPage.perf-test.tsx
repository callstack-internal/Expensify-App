import type * as NativeNavigation from '@react-navigation/native';
import {fireEvent, screen} from '@testing-library/react-native';
import React from 'react';
import Onyx from 'react-native-onyx';
import {measureRenders} from 'reassure';
import ONYXKEYS from '@src/ONYXKEYS';
import SearchFiltersTagPage from '@src/pages/Search/SearchAdvancedFiltersPage/SearchFiltersTagPage';
import * as TestHelper from '../utils/TestHelper';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';
import wrapInAct from '../utils/wrapInActHelper';
import wrapOnyxWithWaitForBatchedUpdates from '../utils/wrapOnyxWithWaitForBatchedUpdates';

// Mock Navigation
jest.mock('@libs/Navigation/Navigation', () => ({
    goBack: jest.fn(),
}));

// Mock React Navigation hooks
jest.mock('@react-navigation/native', () => {
    const actualNav = jest.requireActual<typeof NativeNavigation>('@react-navigation/native');
    return {
        ...actualNav,
        useFocusEffect: jest.fn(),
        useIsFocused: () => true,
        useRoute: () => ({
            params: {},
        }),
        usePreventRemove: () => jest.fn(),
        useNavigation: () => ({
            navigate: jest.fn(),
            addListener: () => jest.fn(),
            goBack: jest.fn(),
        }),
        createNavigationContainerRef: () => ({
            addListener: () => jest.fn(),
            removeListener: () => jest.fn(),
            isReady: () => jest.fn(),
            getCurrentRoute: () => jest.fn(),
            getState: () => jest.fn(),
        }),
        useNavigationState: () => ({
            routes: [],
        }),
    };
});

// Mock components that are not needed for performance testing
jest.mock('@components/HeaderWithBackButton', () => {
    function MockedHeaderWithBackButton() {
        return null;
    }
    MockedHeaderWithBackButton.displayName = 'MockedHeaderWithBackButton';
    return MockedHeaderWithBackButton;
});

jest.mock('@components/ScreenWrapper', () => {
    const MockedScreenWrapper = ({children}: {children: React.ReactNode}) => children;
    MockedScreenWrapper.displayName = 'MockedScreenWrapper';
    return MockedScreenWrapper;
});

jest.mock('@components/Icon/Expensicons');

// Mock hooks
jest.mock('@hooks/useLocalize', () =>
    jest.fn(() => ({
        translate: jest.fn((key: string): string => key),
        localeCompare: jest.fn((a: string, b: string): number => a.localeCompare(b)),
        numberFormat: jest.fn((number: number): string => number.toString()),
    })),
);

jest.mock('@hooks/useThemeStyles', () =>
    jest.fn(() => ({
        flex1: {},
        mtAuto: {},
        ml3: {marginLeft: 12},
        ph5: {paddingHorizontal: 20},
        pb5: {paddingBottom: 20},
        w100: {width: '100%'},
        flexRow: {flexDirection: 'row'},
        justifyContentBetween: {justifyContent: 'space-between'},
        alignItemsCenter: {alignItems: 'center'},
        textStrong: {fontWeight: 'bold'},
        offlineFeedback: {
            default: {},
            pending: {opacity: 0.5},
            deleted: {textDecorationLine: 'line-through'},
        },
        userSelectNone: {},
        textInputAndIconContainer: (isMarkdownEnabled: boolean) => ({
            flex: isMarkdownEnabled ? undefined : 1,
            zIndex: -1,
            flexDirection: 'row',
        }),
        textInputMultilineContainer: {},
        pointerEventsBoxNone: {},
        textInputLeftIconContainer: {},
        textInputLabelTransformation: (translateY: unknown, scale: unknown, isForTextComponent?: boolean) => ({
            transform: [{translateY: 0}],
            fontSize: isForTextComponent ? 10 : 12,
        }),
        textInputLabelContainer: {},
        textInputLabel: {},
        pointerEventsNone: {},
    })),
);

// Mock actions
jest.mock('@libs/actions/Search', () => ({
    updateAdvancedFilters: jest.fn(),
}));

// Helper function to create mock policy tag lists
const createMockPolicyTagLists = (policyCount: number, tagsPerPolicy: number) => {
    const mockPolicyTagLists: Record<string, unknown> = {};

    for (let i = 0; i < policyCount; i++) {
        const policyID = `policy-${i}`;
        const policyKey = `${ONYXKEYS.COLLECTION.POLICY_TAGS}${policyID}`;

        const tags: Record<string, unknown> = {};
        for (let j = 0; j < tagsPerPolicy; j++) {
            const tagName = `Tag ${i}-${j}`;
            tags[tagName] = {
                name: tagName,
                enabled: true,
            };
        }
        mockPolicyTagLists[policyKey] = {
            tagList1: {
                name: 'Tag List 1',
                required: false,
                tags,
                orderWeight: 0,
            },
        };
    }

    return mockPolicyTagLists;
};

// Helper function to create mock search form data
const createMockSearchForm = (selectedTags: string[] = [], selectedPolicyIDs: string[] = []) => ({
    tag: selectedTags,
    policyID: selectedPolicyIDs,
});

describe('SearchFiltersTagPage Performance Tests', () => {
    beforeAll(() => {
        Onyx.init({
            keys: ONYXKEYS,
            evictableKeys: [ONYXKEYS.COLLECTION.REPORT_ACTIONS],
        });
    });

    beforeEach(() => {
        global.fetch = TestHelper.getGlobalFetchMock();
        wrapOnyxWithWaitForBatchedUpdates(Onyx);

        // Initialize the network key for OfflineWithFeedback
        Onyx.merge(ONYXKEYS.NETWORK, {isOffline: false});
        TestHelper.signInWithTestUser(1, 'email1@test.com', undefined, undefined, 'One').then(waitForBatchedUpdates);
    });

    afterEach(() => {
        Onyx.clear();
    });

    test('[SearchFiltersTagPage] should render with pre-selected tags and policies', async () => {
        const scenario = async () => {
            // Wait for the component to render - no specific test ID needed for performance testing
            await waitForBatchedUpdates();
        };

        await waitForBatchedUpdates();

        const mockPolicyTagLists = createMockPolicyTagLists(5, 30);
        const mockSearchForm = createMockSearchForm(
            ['Tag 0-5', 'Tag 1-10', 'Tag 2-15'], // Selected tags
            ['policy-0', 'policy-1'], // Selected policies
        );

        Onyx.multiSet({
            [ONYXKEYS.FORMS.SEARCH_ADVANCED_FILTERS_FORM]: mockSearchForm,
            ...mockPolicyTagLists,
        });

        await measureRenders(<SearchFiltersTagPage />, {scenario});
    });

    test('[SearchFiltersTagPage] should pick multiple tag options', async () => {
        const scenario = async () => {
            // Wait for the component to render
            await waitForBatchedUpdates();

            // Find and click on tag options that actually exist in the rendered output
            const tagOption1 = await screen.findByText('Tag 0-0');
            const tagOption2 = await screen.findByText('Tag 0-1');
            const tagOption3 = await screen.findByText('Tag 0-10');

            await wrapInAct(() => {
                fireEvent.press(tagOption1);
                fireEvent.press(tagOption2);
                fireEvent.press(tagOption3);
            });
        };

        await waitForBatchedUpdates();

        const mockPolicyTagLists = createMockPolicyTagLists(3, 20);
        const mockSearchForm = createMockSearchForm();

        Onyx.multiSet({
            [ONYXKEYS.FORMS.SEARCH_ADVANCED_FILTERS_FORM]: mockSearchForm,
            ...mockPolicyTagLists,
        });

        await measureRenders(<SearchFiltersTagPage />, {scenario});
    });

    test('[SearchFiltersTagPage] should handle heavy load with 50 policies and 200 tags each (10000 total tags)', async () => {
        const scenario = async () => {
            // Wait for the component to render - no specific test ID needed for performance testing
            await waitForBatchedUpdates();
        };

        await waitForBatchedUpdates();

        const mockPolicyTagLists = createMockPolicyTagLists(50, 200);
        const mockSearchForm = createMockSearchForm();

        Onyx.multiSet({
            [ONYXKEYS.FORMS.SEARCH_ADVANCED_FILTERS_FORM]: mockSearchForm,
            ...mockPolicyTagLists,
        });

        await measureRenders(<SearchFiltersTagPage />, {scenario});
    });
});
