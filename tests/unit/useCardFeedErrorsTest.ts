import {act, renderHook} from '@testing-library/react-native';

import useCardFeedErrors from '@hooks/useCardFeedErrors';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Card} from '@src/types/onyx';

import Onyx from 'react-native-onyx';

import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';

const WORKSPACE_ACCOUNT_ID = 44444444;
const BROKEN_CARD_ID = 1;
const HEALTHY_PERSONAL_CARD_ID = 2;

function createBrokenCard(overrides: Partial<Card> = {}): Card {
    return {
        cardID: BROKEN_CARD_ID,
        accountID: 1,
        bank: CONST.COMPANY_CARD.FEED_BANK_NAME.CHASE,
        fundID: String(WORKSPACE_ACCOUNT_ID),
        cardName: 'Broken card',
        domainName: 'test.exfy',
        fraud: 'none',
        lastFourPAN: '1234',
        lastScrape: '',
        lastUpdated: '',
        lastScrapeResult: 403,
        state: CONST.EXPENSIFY_CARD.STATE.OPEN,
        ...overrides,
    };
}

describe('useCardFeedErrors', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        await Onyx.clear();
        await waitForBatchedUpdates();
    });

    it('should return the errors computed from the card inputs', async () => {
        // Given a company card whose bank connection is broken
        await Onyx.set(ONYXKEYS.CARD_LIST, {[BROKEN_CARD_ID]: createBrokenCard()});
        await waitForBatchedUpdates();

        // When the errors are read
        const {result} = renderHook(() => useCardFeedErrors());

        // Then the broken card lights the RBR of its workspace, as the derived value did
        expect(result.current.all.isFeedConnectionBroken).toBe(true);
        expect(result.current.shouldShowRbrForWorkspaceAccountID[WORKSPACE_ACCOUNT_ID]).toBe(true);
    });

    it('should keep the same reference when a card write leaves the errors unchanged', async () => {
        // Given the errors of a broken card
        await Onyx.set(ONYXKEYS.CARD_LIST, {[BROKEN_CARD_ID]: createBrokenCard()});
        await waitForBatchedUpdates();
        const {result} = renderHook(() => useCardFeedErrors());
        const before = result.current;

        // When a healthy personal card is added, which doesn't change any error
        await act(async () => {
            await Onyx.merge(ONYXKEYS.CARD_LIST, {[HEALTHY_PERSONAL_CARD_ID]: createBrokenCard({cardID: HEALTHY_PERSONAL_CARD_ID, fundID: '0', lastScrapeResult: 200})});
            await waitForBatchedUpdates();
        });

        // Then consumers get the previous object, so they don't re-render
        expect(result.current).toBe(before);
    });

    it('should apply a selector so a row only follows its own workspace', async () => {
        // Given a broken card on one workspace
        await Onyx.set(ONYXKEYS.CARD_LIST, {[BROKEN_CARD_ID]: createBrokenCard()});
        await waitForBatchedUpdates();

        // When a row of that workspace and a row of another workspace select their flag
        const {result: brokenRow} = renderHook(() => useCardFeedErrors((errors) => !!errors.shouldShowRbrForWorkspaceAccountID[WORKSPACE_ACCOUNT_ID]));
        const {result: otherRow} = renderHook(() => useCardFeedErrors((errors) => !!errors.shouldShowRbrForWorkspaceAccountID[WORKSPACE_ACCOUNT_ID + 1]));

        // Then only the row of the broken workspace shows the RBR
        expect(brokenRow.current).toBe(true);
        expect(otherRow.current).toBe(false);
    });

    it('should update when a card write fixes the connection', async () => {
        // Given the errors of a broken card
        await Onyx.set(ONYXKEYS.CARD_LIST, {[BROKEN_CARD_ID]: createBrokenCard()});
        await waitForBatchedUpdates();
        const {result} = renderHook(() => useCardFeedErrors());

        // When the card syncs again
        await act(async () => {
            await Onyx.merge(ONYXKEYS.CARD_LIST, {[BROKEN_CARD_ID]: {lastScrapeResult: 200}});
            await waitForBatchedUpdates();
        });

        // Then the RBR goes away
        expect(result.current.all.isFeedConnectionBroken).toBe(false);
        expect(result.current.shouldShowRbrForWorkspaceAccountID[WORKSPACE_ACCOUNT_ID]).toBe(false);
    });
});
