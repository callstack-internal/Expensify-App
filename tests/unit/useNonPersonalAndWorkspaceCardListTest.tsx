import {act, renderHook} from '@testing-library/react-native';

import useNonPersonalAndWorkspaceCardList from '@hooks/useNonPersonalAndWorkspaceCardList';

import ONYXKEYS from '@src/ONYXKEYS';
import type {CardList} from '@src/types/onyx';

/* eslint-disable @typescript-eslint/naming-convention */
import Onyx from 'react-native-onyx';

import {createRandomCompanyCard, createRandomExpensifyCard} from '../utils/collections/card';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

const WORKSPACE_FEED_KEY = `${ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}workspace_123` as const;

describe('useNonPersonalAndWorkspaceCardList', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        await act(async () => {
            await Onyx.clear();
        });
    });

    it('should follow writes to the card list and the workspace feeds', async () => {
        // Given a non-personal card in the card list
        await act(async () => {
            await Onyx.set(ONYXKEYS.CARD_LIST, {'1': createRandomExpensifyCard(1, {fundID: '123'})});
        });
        const {result} = renderHook(() => useNonPersonalAndWorkspaceCardList());
        await waitForBatchedUpdatesWithAct();
        expect(Object.keys(result.current)).toEqual(['1']);

        // When a workspace feed with another card arrives
        await act(async () => {
            await Onyx.set(WORKSPACE_FEED_KEY, {'2': createRandomCompanyCard(2, {bank: 'vcf'})});
        });
        await waitForBatchedUpdatesWithAct();

        // Then the hook returns both cards, since it reads its inputs live instead of a stored derived value
        expect(Object.keys(result.current).sort()).toEqual(['1', '2']);
    });

    it('should not re-render when a write leaves the merged list unchanged', async () => {
        // Given a non-personal card and a workspace feed card
        await act(async () => {
            await Onyx.set(ONYXKEYS.CARD_LIST, {'1': createRandomExpensifyCard(1, {fundID: '123'})});
            await Onyx.set(WORKSPACE_FEED_KEY, {'2': createRandomCompanyCard(2, {bank: 'vcf'})});
        });
        let renderCount = 0;
        const {result} = renderHook(() => {
            renderCount++;
            return useNonPersonalAndWorkspaceCardList();
        });
        await waitForBatchedUpdatesWithAct();
        const listBeforeWrite = result.current;
        const renderCountBeforeWrite = renderCount;

        // When a personal card is added, which this list filters out
        await act(async () => {
            await Onyx.merge(ONYXKEYS.CARD_LIST, {'3': createRandomExpensifyCard(3, {fundID: '0'})});
        });
        await waitForBatchedUpdatesWithAct();

        // Then the consumer keeps the same list and does not re-render
        expect(result.current).toBe(listBeforeWrite);
        expect(renderCount).toBe(renderCountBeforeWrite);
    });

    it('should give every mounted consumer the same list', async () => {
        // Given two consumers mounted over the same inputs
        await act(async () => {
            await Onyx.set(ONYXKEYS.CARD_LIST, {'1': createRandomExpensifyCard(1, {fundID: '123'})});
        });
        const {result: first} = renderHook(() => useNonPersonalAndWorkspaceCardList());
        const {result: second} = renderHook(() => useNonPersonalAndWorkspaceCardList());
        await waitForBatchedUpdatesWithAct();

        // When a workspace feed card arrives
        await act(async () => {
            await Onyx.set(WORKSPACE_FEED_KEY, {'2': createRandomCompanyCard(2, {bank: 'vcf'})});
        });
        await waitForBatchedUpdatesWithAct();

        // Then both get the same object, because the merge runs once per pair of inputs, not once per consumer
        expect(second.current).toBe(first.current);
    });

    it('should apply the selector to the merged list', async () => {
        // Given a non-personal card and a workspace feed card
        await act(async () => {
            await Onyx.set(ONYXKEYS.CARD_LIST, {'1': createRandomExpensifyCard(1, {fundID: '123'})});
            await Onyx.set(WORKSPACE_FEED_KEY, {'2': createRandomCompanyCard(2, {bank: 'vcf'})});
        });

        // When a consumer selects only the card count
        const {result} = renderHook(() => useNonPersonalAndWorkspaceCardList((cardList) => Object.keys(cardList).length));
        await waitForBatchedUpdatesWithAct();

        // Then it gets the count of the merged list, so selector consumers see the same cards as everyone else
        expect(result.current).toBe(2);
    });

    it('should run each selector once per merged list, however many consumers use it', async () => {
        // Given two consumers mounted with the same selector
        await act(async () => {
            await Onyx.set(ONYXKEYS.CARD_LIST, {'1': createRandomExpensifyCard(1, {fundID: '123'})});
        });
        const countCards = jest.fn((cardList: CardList) => Object.keys(cardList).length);
        renderHook(() => useNonPersonalAndWorkspaceCardList(countCards));
        renderHook(() => useNonPersonalAndWorkspaceCardList(countCards));
        await waitForBatchedUpdatesWithAct();
        countCards.mockClear();

        // When a workspace feed card arrives, and then a personal card that leaves the merged list unchanged
        await act(async () => {
            await Onyx.set(WORKSPACE_FEED_KEY, {'2': createRandomCompanyCard(2, {bank: 'vcf'})});
        });
        await waitForBatchedUpdatesWithAct();
        await act(async () => {
            await Onyx.merge(ONYXKEYS.CARD_LIST, {'3': createRandomExpensifyCard(3, {fundID: '0'})});
        });
        await waitForBatchedUpdatesWithAct();

        // Then the selector ran once for the one new merged list, since a big card list makes every run cost a full scan
        expect(countCards).toHaveBeenCalledTimes(1);
    });
});
