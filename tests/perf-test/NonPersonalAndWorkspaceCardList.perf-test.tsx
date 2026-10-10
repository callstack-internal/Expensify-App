import {render, screen} from '@testing-library/react-native';

import ComposeProviders from '@components/ComposeProviders';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import MoneyRequestView from '@components/ReportActionItem/MoneyRequestView';
import ScreenWrapperStatusContext from '@components/ScreenWrapper/ScreenWrapperStatusContext';

import useCardFeedsForDisplay from '@hooks/useCardFeedsForDisplay';
import useSearchTypeMenuSections from '@hooks/useSearchTypeMenuSections';

import useHomeInsightConfigs from '@pages/home/InsightsSection/useHomeInsightConfigs';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Card, CardList, Policy, WorkspaceCardsList} from '@src/types/onyx';

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
jest.mock('@components/ReportActionItem/MoneyRequestReceiptView', () => {
    const RN = jest.requireActual<Record<string, React.ComponentType<{testID?: string}>>>('react-native');
    return () => <RN.View testID="money-request-receipt-view" />;
});
jest.mock('@pages/inbox/report/AnimatedEmptyStateBackground', () => {
    const RN = jest.requireActual<Record<string, React.ComponentType<{testID?: string}>>>('react-native');
    return () => <RN.View testID="animated-bg" />;
});

const CURRENT_USER_ACCOUNT_ID = 1;
const CURRENT_USER_EMAIL = 'email1@test.com';
const POLICY_ID = 'policy_cards_perf';
const WORKSPACE_ACCOUNT_ID = 777;
const EXPENSE_REPORT_ID = 'expense_cards_perf';
const MONEY_REQUEST_VIEW_COUNT = 3;
const HOOK_CONSUMER_COUNT = 3;
const SMALL_CARD_COUNT = 20;
const LARGE_CARD_COUNT = 3000;
const WRITES_PER_SCENARIO = 10;
const FIRST_PERSONAL_CARD_ID = 900000;
const RENAMED_CARD_ID = 200001;

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
        cardList[userCardID] = createCard(userCardID, CONST.EXPENSIFY_CARD.BANK, String(5000 + (index % 3)));
        const expensifyCardID = 100000 + index;
        expensifyFeed[expensifyCardID] = createCard(expensifyCardID, CONST.EXPENSIFY_CARD.BANK, '5000');
        const companyCardID = 200000 + index;
        companyFeed[companyCardID] = createCard(companyCardID, CONST.COMPANY_CARD.FEED_BANK_NAME.VISA, undefined);
    }
    return {cardList, workspaceFeeds: [expensifyFeed, companyFeed]};
}

const smallCards = buildCards(SMALL_CARD_COUNT);
const largeCards = buildCards(LARGE_CARD_COUNT);

const policy = createMock<Policy>({
    id: POLICY_ID,
    type: CONST.POLICY.TYPE.TEAM,
    role: CONST.POLICY.ROLE.ADMIN,
    name: 'Cards Policy',
    owner: CURRENT_USER_EMAIL,
    outputCurrency: CONST.CURRENCY.USD,
});

const SCREEN_WRAPPER_STATUS = {didScreenTransitionEnd: true, shouldUseNarrowLayoutOnWideRHP: false, isSafeAreaTopPaddingApplied: true, isSafeAreaBottomPaddingApplied: true};

function TypeMenuSectionsConsumer() {
    useSearchTypeMenuSections();
    return <View testID="type-menu-sections-consumer" />;
}

function CardFeedsConsumer() {
    useCardFeedsForDisplay();
    return <View testID="card-feeds-consumer" />;
}

function InsightConfigsConsumer() {
    useHomeInsightConfigs();
    return <View testID="insight-configs-consumer" />;
}

/** Search and Home surfaces that read the card list through selectors, without the report attributes, so their re-renders isolate card list churn */
function SearchCardConsumers() {
    return (
        <>
            {Array.from({length: HOOK_CONSUMER_COUNT}, (value, index) => (
                <React.Fragment key={index}>
                    <TypeMenuSectionsConsumer />
                    <CardFeedsConsumer />
                    <InsightConfigsConsumer />
                </React.Fragment>
            ))}
        </>
    );
}

/** Expense views that read the whole merged card list next to the Search surfaces, as when an expense is open over Search */
function AllCardConsumers() {
    return (
        <ComposeProviders components={[OnyxListItemProvider]}>
            <ScreenWrapperStatusContext.Provider value={SCREEN_WRAPPER_STATUS}>
                {Array.from({length: MONEY_REQUEST_VIEW_COUNT}, (value, index) => (
                    <MoneyRequestView
                        key={index}
                        transactionThreadReport={{...LHNTestUtils.getFakeReport(), reportID: `thread_${index}`, parentReportID: EXPENSE_REPORT_ID, parentReportActionID: 'parent_action'}}
                        parentReportID={EXPENSE_REPORT_ID}
                        expensePolicy={policy}
                        shouldShowAnimatedBackground={false}
                    />
                ))}
                <SearchCardConsumers />
            </ScreenWrapperStatusContext.Provider>
        </ComposeProviders>
    );
}

async function seed(cards: ReturnType<typeof buildCards>) {
    await Onyx.multiSet({
        [ONYXKEYS.CARD_LIST]: cards.cardList,
        [WORKSPACE_FEED_KEYS[0]]: cards.workspaceFeeds.at(0),
        [WORKSPACE_FEED_KEYS[1]]: cards.workspaceFeeds.at(1),
        [`${ONYXKEYS.COLLECTION.POLICY}${POLICY_ID}` as const]: policy,
        [`${ONYXKEYS.COLLECTION.REPORT}${EXPENSE_REPORT_ID}` as const]: {
            reportID: EXPENSE_REPORT_ID,
            type: CONST.REPORT.TYPE.EXPENSE,
            policyID: POLICY_ID,
            ownerAccountID: CURRENT_USER_ACCOUNT_ID,
            managerID: CURRENT_USER_ACCOUNT_ID,
            stateNum: CONST.REPORT.STATE_NUM.OPEN,
            statusNum: CONST.REPORT.STATUS_NUM.OPEN,
        },
        [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${EXPENSE_REPORT_ID}` as const]: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            parent_action: {
                ...LHNTestUtils.getFakeReportAction(),
                reportActionID: 'parent_action',
                actionName: CONST.REPORT.ACTIONS.TYPE.IOU,
                actorAccountID: CURRENT_USER_ACCOUNT_ID,
                originalMessage: {type: CONST.IOU.REPORT_ACTION_TYPE.CREATE, IOUTransactionID: 'txn_cards_perf', amount: 5000, currency: CONST.CURRENCY.USD},
            },
        },
        [`${ONYXKEYS.COLLECTION.TRANSACTION}txn_cards_perf` as const]: {
            transactionID: 'txn_cards_perf',
            reportID: EXPENSE_REPORT_ID,
            amount: 5000,
            currency: CONST.CURRENCY.USD,
            created: '2026-06-01',
            merchant: 'Card merchant',
            cardID: RENAMED_CARD_ID,
            comment: {},
        },
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

describe('Non-personal and workspace card list consumers on card writes', () => {
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

    test('[NonPersonalCardList] should re-render consumers when unassigned workspace cards change', async () => {
        // Given expense views and Search surfaces mounted over a small card list
        await seed(smallCards);

        // Reassure runs the scenario several times against one seeded Onyx, so every run writes keys that don't exist yet
        let run = 0;
        const scenario = async () => {
            await screen.findAllByTestId('card-feeds-consumer');

            // When the unassigned cards of a workspace feed change repeatedly, which leaves the merged list unchanged
            await writeUnassignedCards(`small ${run}`);
            run++;
        };

        // Then reassure measures what the unchanged merges cost the consumers
        await measureRenders(<AllCardConsumers />, {scenario});
    });

    test('[NonPersonalCardList] should not re-render Search surfaces when a personal card changes', async () => {
        // Given only the Search and Home surfaces, which read the merged list through selectors and nothing else of the cards
        await seed(smallCards);

        let run = 0;
        const scenario = async () => {
            await screen.findAllByTestId('card-feeds-consumer');

            // When personal cards are added to the card list, which the merged list filters out
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                const cardID = FIRST_PERSONAL_CARD_ID + run * WRITES_PER_SCENARIO + index;
                await Onyx.merge(ONYXKEYS.CARD_LIST, {[cardID]: createCard(cardID, CONST.COMPANY_CARD.FEED_BANK_NAME.VISA, '0')});
                await waitForBatchedUpdates();
            }
            run++;
        };

        // Then every render here comes from the merged list or a selected value changing reference without changing content
        await measureRenders(<SearchCardConsumers />, {scenario});
    });

    test('[NonPersonalCardList] should re-render consumers when a company card is renamed', async () => {
        // Given expense views and Search surfaces mounted over a small card list
        await seed(smallCards);

        let run = 0;
        const scenario = async () => {
            await screen.findAllByTestId('card-feeds-consumer');

            // When a workspace company card is renamed on every write, so the merged list really changes
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                await Onyx.merge(WORKSPACE_FEED_KEYS[1], {[RENAMED_CARD_ID]: {cardName: `Renamed ${run}-${index}`}});
                await waitForBatchedUpdates();
            }
            run++;
        };

        // Then reassure measures the cost of a real change, which both versions have to pay
        await measureRenders(<AllCardConsumers />, {scenario});
    });

    test('[NonPersonalCardList] should re-render consumers when unassigned workspace cards change in a large card list', async () => {
        // Given the same consumers over 9000 cards
        await seed(largeCards);

        let run = 0;
        const scenario = async () => {
            await screen.findAllByTestId('card-feeds-consumer');

            // When the unassigned cards of a workspace feed change repeatedly, so every write merges the whole list again
            await writeUnassignedCards(`large ${run}`);
            run++;
        };

        // Then reassure measures the render cost, which grows if each consumer merges the list during render
        await measureRenders(<AllCardConsumers />, {scenario});
    });

    test('[NonPersonalCardList] should process unassigned workspace card writes in a large card list', async () => {
        // Given the consumers mounted over 9000 cards
        await seed(largeCards);
        render(<AllCardConsumers />);
        await screen.findAllByTestId('card-feeds-consumer');

        // When the unassigned cards of a workspace feed change repeatedly
        let run = 0;
        const writeLoop = async () => {
            await writeUnassignedCards(`timed ${run}`);
            run++;
        };

        // Then reassure times the whole write loop, including work done outside React renders such as derived computes and their writes
        await measureAsyncFunction(writeLoop);
    });

    test('[NonPersonalCardList] should process company card renames in a large card list', async () => {
        // Given the consumers mounted over 9000 cards
        await seed(largeCards);
        render(<AllCardConsumers />);
        await screen.findAllByTestId('card-feeds-consumer');

        // When a workspace company card is renamed on every write
        let run = 0;
        const writeLoop = async () => {
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                await Onyx.merge(WORKSPACE_FEED_KEYS[1], {[RENAMED_CARD_ID]: {cardName: `Timed rename ${run}-${index}`}});
                await waitForBatchedUpdates();
            }
            run++;
        };

        // Then reassure times the loop when both versions must merge and deliver a new list
        await measureAsyncFunction(writeLoop);
    });
});
