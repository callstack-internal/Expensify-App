import {render, screen} from '@testing-library/react-native';

import ComposeProviders from '@components/ComposeProviders';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import TransactionPreviewContent from '@components/ReportActionItem/TransactionPreview/TransactionPreviewContent';
import WorkspaceRowBrickRoadIndicator from '@components/Tables/WorkspaceListTable/WorkspaceRowBrickRoadIndicator';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Card, PersonalDetailsList, Policy, Report, ReportAction, Transaction, WorkspaceCardsList} from '@src/types/onyx';

import React from 'react';
import {View} from 'react-native';
import Onyx from 'react-native-onyx';
import {measureAsyncFunction, measureRenders} from 'reassure';

import createMock from '../utils/createMock';
import * as LHNTestUtils from '../utils/LHNTestUtils';
import * as TestHelper from '../utils/TestHelper';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';
import wrapOnyxWithWaitForBatchedUpdates from '../utils/wrapOnyxWithWaitForBatchedUpdates';

jest.mock('@hooks/useScreenWrapperTransitionStatus', () => ({
    __esModule: true,
    default: () => ({
        didScreenTransitionEnd: true,
    }),
}));

const WORKSPACE_COUNT = 20;
const PREVIEW_COUNT = 10;
const SMALL_CARDS_PER_WORKSPACE = 5;
const LARGE_CARDS_PER_WORKSPACE = 100;
const WRITES_PER_SCENARIO = 10;
const FIRST_WORKSPACE_ACCOUNT_ID = 70000;
const CURRENT_USER_ACCOUNT_ID = 1;
const CURRENT_USER_EMAIL = 'email1@test.com';
const FEED = CONST.COMPANY_CARD.FEED_BANK_NAME.VISA;
const HEALTHY_SCRAPE_RESULT = 200;
const BROKEN_SCRAPE_RESULT = 403;

const workspaceIndexes = Array.from({length: WORKSPACE_COUNT}, (value, index) => index);
const previewIndexes = Array.from({length: PREVIEW_COUNT}, (value, index) => index);

function getPolicyID(workspaceIndex: number) {
    return `cardFeedErrorsPolicy${workspaceIndex}`;
}

function getWorkspaceAccountID(workspaceIndex: number) {
    return FIRST_WORKSPACE_ACCOUNT_ID + workspaceIndex;
}

function getWorkspaceCardsKey(workspaceIndex: number) {
    return `${ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}${getWorkspaceAccountID(workspaceIndex)}_${FEED}` as const;
}

function getCardID(workspaceIndex: number, cardIndex: number) {
    return getWorkspaceAccountID(workspaceIndex) * 1000 + cardIndex;
}

function createCard(workspaceIndex: number, cardIndex: number): Card {
    return {
        cardID: getCardID(workspaceIndex, cardIndex),
        accountID: CURRENT_USER_ACCOUNT_ID,
        bank: FEED,
        fundID: String(getWorkspaceAccountID(workspaceIndex)),
        cardName: `Card ${cardIndex}`,
        domainName: 'test.exfy',
        fraud: CONST.EXPENSIFY_CARD.FRAUD_TYPES.NONE,
        lastFourPAN: '1234',
        lastScrape: '',
        lastUpdated: '',
        lastScrapeResult: HEALTHY_SCRAPE_RESULT,
        state: CONST.EXPENSIFY_CARD.STATE.OPEN,
    };
}

function createWorkspaceCards(cardsPerWorkspace: number) {
    return Object.fromEntries(
        workspaceIndexes.map((workspaceIndex) => {
            const cards: WorkspaceCardsList = Object.fromEntries(
                Array.from({length: cardsPerWorkspace}, (value, cardIndex) => [String(getCardID(workspaceIndex, cardIndex)), createCard(workspaceIndex, cardIndex)]),
            );
            return [getWorkspaceCardsKey(workspaceIndex), cards];
        }),
    );
}

const policies = Object.fromEntries(
    workspaceIndexes.map((workspaceIndex) => [
        `${ONYXKEYS.COLLECTION.POLICY}${getPolicyID(workspaceIndex)}`,
        createMock<Policy>({
            id: getPolicyID(workspaceIndex),
            name: `Workspace ${workspaceIndex}`,
            type: CONST.POLICY.TYPE.CORPORATE,
            role: CONST.POLICY.ROLE.ADMIN,
            owner: CURRENT_USER_EMAIL,
            outputCurrency: CONST.CURRENCY.USD,
            policyAccountID: getWorkspaceAccountID(workspaceIndex),
        }),
    ]),
);

const personalDetails: PersonalDetailsList = {
    [CURRENT_USER_ACCOUNT_ID]: {accountID: CURRENT_USER_ACCOUNT_ID, login: CURRENT_USER_EMAIL, displayName: 'One'},
};

function getReportID(previewIndex: number) {
    return `cardFeedErrorsReport${previewIndex}`;
}

function getTransactionID(previewIndex: number) {
    return `cardFeedErrorsTransaction${previewIndex}`;
}

const previewReports = previewIndexes.map((previewIndex) =>
    createMock<Report>({
        reportID: getReportID(previewIndex),
        type: CONST.REPORT.TYPE.EXPENSE,
        policyID: getPolicyID(0),
        ownerAccountID: CURRENT_USER_ACCOUNT_ID,
        stateNum: CONST.REPORT.STATE_NUM.OPEN,
        statusNum: CONST.REPORT.STATUS_NUM.OPEN,
    }),
);

const previewTransactions = previewIndexes.map((previewIndex) =>
    createMock<Transaction>({
        transactionID: getTransactionID(previewIndex),
        reportID: getReportID(previewIndex),
        amount: 5000,
        currency: CONST.CURRENCY.USD,
        created: '2026-04-20',
        merchant: `Merchant ${previewIndex}`,
        comment: {},
    }),
);

const previewActions = previewIndexes.map((previewIndex) =>
    createMock<ReportAction>({
        ...LHNTestUtils.getFakeReportAction(),
        reportActionID: `cardFeedErrorsAction${previewIndex}`,
        reportID: getReportID(previewIndex),
        actionName: CONST.REPORT.ACTIONS.TYPE.IOU,
        actorAccountID: CURRENT_USER_ACCOUNT_ID,
        originalMessage: {
            type: CONST.IOU.REPORT_ACTION_TYPE.CREATE,
            IOUTransactionID: getTransactionID(previewIndex),
            amount: 5000,
            currency: CONST.CURRENCY.USD,
        },
    }),
);

const noop = () => {};

/** Workspace list rows, each subscribed to whether its own workspace shows the card feed RBR */
function WorkspaceRows() {
    return (
        <View testID="workspace-rows">
            {workspaceIndexes.map((workspaceIndex) => (
                <WorkspaceRowBrickRoadIndicator
                    key={workspaceIndex}
                    policyID={getPolicyID(workspaceIndex)}
                />
            ))}
        </View>
    );
}

/** Expense previews, the report-action items that read the whole card feed errors value */
function TransactionPreviews() {
    return (
        <>
            {previewIndexes.map((previewIndex) => (
                <TransactionPreviewContent
                    key={previewIndex}
                    action={previewActions.at(previewIndex) ?? createMock<ReportAction>({})}
                    isWhisper={false}
                    isHovered={false}
                    chatReport={undefined}
                    personalDetails={personalDetails}
                    report={previewReports.at(previewIndex)}
                    policy={undefined}
                    transaction={previewTransactions.at(previewIndex)}
                    violations={[]}
                    transactionRawAmount={5000}
                    offlineWithFeedbackOnClose={noop}
                    containerStyles={[]}
                    transactionPreviewWidth={303}
                    isBillSplit={false}
                    areThereDuplicates={false}
                    sessionAccountID={CURRENT_USER_ACCOUNT_ID}
                    walletTermsErrors={undefined}
                    reportPreviewAction={undefined}
                    navigateToReviewFields={noop}
                    routeName="Report"
                />
            ))}
        </>
    );
}

/** Report-action previews and workspace rows mounted together, so every write reaches many card feed error consumers */
function CardFeedErrorsConsumers() {
    return (
        <ComposeProviders components={[OnyxListItemProvider]}>
            <TransactionPreviews />
            <WorkspaceRows />
        </ComposeProviders>
    );
}

async function seed(cardsPerWorkspace: number) {
    await Onyx.multiSet({
        [ONYXKEYS.PERSONAL_DETAILS_LIST]: personalDetails,
        ...policies,
        ...createWorkspaceCards(cardsPerWorkspace),
        ...Object.fromEntries(previewReports.map((report) => [`${ONYXKEYS.COLLECTION.REPORT}${report.reportID}`, report])),
        ...Object.fromEntries(previewTransactions.map((transaction) => [`${ONYXKEYS.COLLECTION.TRANSACTION}${transaction.transactionID}`, transaction])),
    });
    await waitForBatchedUpdates();
}

/** Renames a healthy card, which changes no error */
async function renameHealthyCard(label: string) {
    for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
        await Onyx.merge(getWorkspaceCardsKey(0), {[getCardID(0, 0)]: {cardName: `Renamed ${label}-${index}`}});
        await waitForBatchedUpdates();
    }
}

/** Breaks and repairs one card's bank connection, so every write changes the errors; ends healthy so runs can repeat */
async function toggleBrokenCard() {
    for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
        const lastScrapeResult = index % 2 === 0 ? BROKEN_SCRAPE_RESULT : HEALTHY_SCRAPE_RESULT;
        await Onyx.merge(getWorkspaceCardsKey(0), {[getCardID(0, 0)]: {lastScrapeResult}});
        await waitForBatchedUpdates();
    }
}

describe('Card feed errors consumers on card writes', () => {
    beforeAll(() => {
        Onyx.init({
            keys: ONYXKEYS,
            evictableKeys: [ONYXKEYS.COLLECTION.REPORT_ACTIONS],
        });
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

    test('[CardFeedErrors] should re-render when a healthy card is renamed', async () => {
        // Given ten expense previews and twenty workspace rows over a small set of healthy workspace cards
        await seed(SMALL_CARDS_PER_WORKSPACE);

        // Reassure runs the scenario several times against one seeded Onyx, so every run writes a name that doesn't exist yet
        let run = 0;
        const scenario = async () => {
            await screen.findByTestId('workspace-rows');

            // When a healthy card is renamed repeatedly, which leaves the card feed errors unchanged
            await renameHealthyCard(`small-${run}`);
            run++;
        };

        // Then reassure measures what the unrelated writes cost the consumers
        await measureRenders(<CardFeedErrorsConsumers />, {scenario});
    });

    test('[CardFeedErrors] should not re-render workspace rows when a healthy card is renamed', async () => {
        // Given only the workspace rows, which don't read the report attributes, so their renders isolate card feed error churn
        await seed(SMALL_CARDS_PER_WORKSPACE);

        let run = 0;
        const scenario = async () => {
            await screen.findByTestId('workspace-rows');

            // When a healthy card is renamed repeatedly
            await renameHealthyCard(`rows-${run}`);
            run++;
        };

        // Then every extra render comes from the card feed errors changing without a new RBR state
        await measureRenders(<WorkspaceRows />, {scenario});
    });

    test('[CardFeedErrors] should re-render when a healthy card is renamed in a large card list', async () => {
        // Given the same consumers over 2000 workspace cards
        await seed(LARGE_CARDS_PER_WORKSPACE);

        let run = 0;
        const scenario = async () => {
            await screen.findByTestId('workspace-rows');

            // When a healthy card is renamed repeatedly, so every write rebuilds the errors from every card
            await renameHealthyCard(`large-${run}`);
            run++;
        };

        // Then reassure measures the render cost, which grows if each consumer rebuilds the errors on its own
        await measureRenders(<CardFeedErrorsConsumers />, {scenario});
    });

    test('[CardFeedErrors] should re-render when a card connection breaks and is repaired', async () => {
        // Given the consumers over a small set of healthy workspace cards
        await seed(SMALL_CARDS_PER_WORKSPACE);

        const scenario = async () => {
            await screen.findByTestId('workspace-rows');

            // When one card's bank connection breaks and is repaired, so the errors and the first workspace's RBR really change
            await toggleBrokenCard();
        };

        // Then reassure measures the cost of a real error change, which both versions have to pay
        await measureRenders(<CardFeedErrorsConsumers />, {scenario});
    });

    test('[CardFeedErrors] should process healthy card renames in a large card list', async () => {
        // Given the consumers mounted over 2000 workspace cards
        await seed(LARGE_CARDS_PER_WORKSPACE);
        render(<CardFeedErrorsConsumers />);
        await screen.findByTestId('workspace-rows');

        // When a healthy card is renamed repeatedly
        let run = 0;
        const writeRenames = async () => {
            await renameHealthyCard(`timed-${run}`);
            run++;
        };

        // Then reassure times the whole write loop, including work done outside React renders such as derived computes and their writes
        await measureAsyncFunction(writeRenames);
    });
});
