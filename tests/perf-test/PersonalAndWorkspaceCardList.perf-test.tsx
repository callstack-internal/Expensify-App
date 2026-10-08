import {render, screen} from '@testing-library/react-native';

import useFilterCardValue from '@components/Search/hooks/useFilterCardValue';
import useFilterFeedData from '@components/Search/hooks/useFilterFeedData';

import useAdvancedSearchFilters from '@hooks/useAdvancedSearchFilters';
import useSearchSections from '@hooks/useSearchSections';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Card, CardList, WorkspaceCardsList} from '@src/types/onyx';

import type * as Navigation from '@react-navigation/native';

import React from 'react';
import {View} from 'react-native';
import Onyx from 'react-native-onyx';
import {measureAsyncFunction, measureRenders} from 'reassure';

import createMock from '../utils/createMock';
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
jest.mock('@react-navigation/native', () => {
    const actualNav = jest.requireActual<typeof Navigation>('@react-navigation/native');
    return {
        ...actualNav,
        useNavigationState: () => true,
        useRoute: jest.fn(() => ({key: '', name: '', params: {reportID: '1'}})),
        useFocusEffect: jest.fn(),
        useIsFocused: () => true,
        useNavigation: () => ({
            navigate: jest.fn(),
            addListener: jest.fn(() => jest.fn()),
        }),
        createNavigationContainerRef: jest.fn(),
    };
});
const CURRENT_USER_ACCOUNT_ID = 1;
const CURRENT_USER_EMAIL = 'email1@test.com';
const WORKSPACE_ACCOUNT_ID = 777;
const HOOK_CONSUMER_COUNT = 3;
const SMALL_CARD_COUNT = 20;
const LARGE_CARD_COUNT = 3000;
const WRITES_PER_SCENARIO = 10;
const RENAMED_CARD_ID = 1;

const WORKSPACE_FEED_KEYS = [
    `${ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}${WORKSPACE_ACCOUNT_ID}_${CONST.EXPENSIFY_CARD.BANK}`,
    `${ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}${WORKSPACE_ACCOUNT_ID}_${CONST.COMPANY_CARD.FEED_BANK_NAME.VISA}`,
] as const;

function createCard(cardID: number, bank: Card['bank'], fundID: string | undefined): Card {
    return createMock<Card>({
        cardID,
        bank,
        fundID,
        state: CONST.EXPENSIFY_CARD.STATE.OPEN,
        lastFourPAN: String(1000 + (cardID % 9000)),
        cardName: `Card ${cardID}`,
        accountID: CURRENT_USER_ACCOUNT_ID,
        domainName: 'expensify-policy.exfy',
    });
}

function buildCards(count: number) {
    const cardList: CardList = {};
    const expensifyFeed: WorkspaceCardsList = {};
    const companyFeed: WorkspaceCardsList = {};
    for (let index = 0; index < count; index++) {
        const userCardID = index + 1;
        cardList[userCardID] = index % 2 === 0 ? createCard(userCardID, CONST.COMPANY_CARD.FEED_BANK_NAME.VISA, '0') : createCard(userCardID, CONST.EXPENSIFY_CARD.BANK, '5000');
        const expensifyCardID = 100000 + index;
        expensifyFeed[expensifyCardID] = createCard(expensifyCardID, CONST.EXPENSIFY_CARD.BANK, '5000');
        const companyCardID = 200000 + index;
        companyFeed[companyCardID] = createCard(companyCardID, CONST.COMPANY_CARD.FEED_BANK_NAME.VISA, undefined);
    }
    return {cardList, workspaceFeeds: [expensifyFeed, companyFeed]};
}

const smallCards = buildCards(SMALL_CARD_COUNT);
const largeCards = buildCards(LARGE_CARD_COUNT);

const SELECTED_CARD_IDS = ['1', '2'];

function SearchSectionsConsumer() {
    useSearchSections();
    return <View testID="search-sections-consumer" />;
}

function FeedDataConsumer() {
    useFilterFeedData(undefined);
    return <View testID="feed-data-consumer" />;
}

function CardValueConsumer() {
    useFilterCardValue(SELECTED_CARD_IDS);
    return <View testID="card-value-consumer" />;
}

function AdvancedFiltersConsumer() {
    useAdvancedSearchFilters(CONST.SEARCH.DATA_TYPES.EXPENSE);
    return <View testID="advanced-filters-consumer" />;
}

/** Search filter surfaces that read the card list through selectors and nothing else of the cards, so their re-renders isolate card list churn */
function CardFilterConsumers() {
    return (
        <>
            {Array.from({length: HOOK_CONSUMER_COUNT}, (value, index) => (
                <React.Fragment key={index}>
                    <CardValueConsumer />
                    <AdvancedFiltersConsumer />
                </React.Fragment>
            ))}
        </>
    );
}

/** Every Search surface that reads the merged card list, mounted together as on the Search page with its filters open */
function AllCardConsumers() {
    return (
        <>
            {Array.from({length: HOOK_CONSUMER_COUNT}, (value, index) => (
                <React.Fragment key={index}>
                    <SearchSectionsConsumer />
                    <FeedDataConsumer />
                </React.Fragment>
            ))}
            <CardFilterConsumers />
        </>
    );
}

async function seed(cards: ReturnType<typeof buildCards>) {
    await Onyx.multiSet({
        [ONYXKEYS.CARD_LIST]: cards.cardList,
        [WORKSPACE_FEED_KEYS[0]]: cards.workspaceFeeds.at(0),
        [WORKSPACE_FEED_KEYS[1]]: cards.workspaceFeeds.at(1),
    });
    await waitForBatchedUpdates();
}

/** Writes to a workspace feed's list of cards still to assign, which are not cards, so the merged list keeps its content */
async function writeUnassignedCards(label: string) {
    for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
        await Onyx.merge(WORKSPACE_FEED_KEYS[1], {cardList: {[`account ${label}-${index}`]: 'encrypted'}});
        await waitForBatchedUpdates();
    }
}

describe('Personal and workspace card list consumers on card writes', () => {
    beforeAll(() => {
        Onyx.init({
            keys: ONYXKEYS,
            evictableKeys: [ONYXKEYS.COLLECTION.REPORT_ACTIONS],
        });
        // Required lazily so the navigation mocks above are registered before the engine's imports load it
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        require('@userActions/OnyxDerived').default();
    });

    beforeEach(async () => {
        global.fetch = TestHelper.getGlobalFetchMock();
        wrapOnyxWithWaitForBatchedUpdates(Onyx);
        await TestHelper.signInWithTestUser(CURRENT_USER_ACCOUNT_ID, CURRENT_USER_EMAIL, undefined, undefined, 'One');
        await waitForBatchedUpdates();
    });

    afterEach(async () => {
        await Onyx.clear();
        await waitForBatchedUpdates();
    });

    test('[PersonalCardList] should re-render Search surfaces when unassigned workspace cards change', async () => {
        // Given every Search surface that reads the card list, mounted over a small card list
        await seed(smallCards);

        // Reassure runs the scenario several times against one seeded Onyx, so every run writes keys that don't exist yet
        let run = 0;
        const scenario = async () => {
            await screen.findAllByTestId('feed-data-consumer');

            // When the unassigned cards of a workspace feed change repeatedly, which leaves the merged list unchanged
            await writeUnassignedCards(`small ${run}`);
            run++;
        };

        // Then reassure measures what the unchanged merges cost the consumers
        await measureRenders(<AllCardConsumers />, {scenario});
    });

    test('[PersonalCardList] should not re-render card filters when unassigned workspace cards change', async () => {
        // Given only the card filters, which read the merged list through selectors and nothing else of the cards
        await seed(smallCards);

        let run = 0;
        const scenario = async () => {
            await screen.findAllByTestId('card-value-consumer');

            // When the unassigned cards of a workspace feed change repeatedly, which leaves the merged list unchanged
            await writeUnassignedCards(`isolated ${run}`);
            run++;
        };

        // Then every render here comes from the merged list or a selected value changing reference without changing content
        await measureRenders(<CardFilterConsumers />, {scenario});
    });

    test('[PersonalCardList] should re-render Search surfaces when a personal card is renamed', async () => {
        // Given every Search surface that reads the card list, mounted over a small card list
        await seed(smallCards);

        let run = 0;
        const scenario = async () => {
            await screen.findAllByTestId('feed-data-consumer');

            // When a personal card is renamed on every write, so the merged list really changes
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                await Onyx.merge(ONYXKEYS.CARD_LIST, {[RENAMED_CARD_ID]: {cardName: `Renamed ${run}-${index}`}});
                await waitForBatchedUpdates();
            }
            run++;
        };

        // Then reassure measures the cost of a real change, which both versions have to pay
        await measureRenders(<AllCardConsumers />, {scenario});
    });

    test('[PersonalCardList] should re-render Search surfaces when unassigned workspace cards change in a large card list', async () => {
        // Given the same consumers over 9000 cards
        await seed(largeCards);

        let run = 0;
        const scenario = async () => {
            await screen.findAllByTestId('feed-data-consumer');

            // When the unassigned cards of a workspace feed change repeatedly, so every write merges the whole list again
            await writeUnassignedCards(`large ${run}`);
            run++;
        };

        // Then reassure measures the render cost, which grows if each consumer scans the list during render
        await measureRenders(<AllCardConsumers />, {scenario});
    });

    test('[PersonalCardList] should process unassigned workspace card writes in a large card list', async () => {
        // Given the consumers mounted over 9000 cards
        await seed(largeCards);
        render(<AllCardConsumers />);
        await screen.findAllByTestId('feed-data-consumer');

        // When the unassigned cards of a workspace feed change repeatedly
        let run = 0;
        const writeLoop = async () => {
            await writeUnassignedCards(`timed ${run}`);
            run++;
        };

        // Then reassure times the whole write loop, including work done outside React renders such as derived computes and their writes
        await measureAsyncFunction(writeLoop);
    });

    test('[PersonalCardList] should process personal card renames in a large card list', async () => {
        // Given the consumers mounted over 9000 cards
        await seed(largeCards);
        render(<AllCardConsumers />);
        await screen.findAllByTestId('feed-data-consumer');

        // When a personal card is renamed on every write
        let run = 0;
        const writeLoop = async () => {
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                await Onyx.merge(ONYXKEYS.CARD_LIST, {[RENAMED_CARD_ID]: {cardName: `Timed rename ${run}-${index}`}});
                await waitForBatchedUpdates();
            }
            run++;
        };

        // Then reassure times the loop when both versions must merge and deliver a new list
        await measureAsyncFunction(writeLoop);
    });
});
