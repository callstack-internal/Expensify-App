import ONYXKEYS from '@src/ONYXKEYS';
import type {CardList} from '@src/types/onyx';

import {personalAndWorkspaceCardListSelector} from '@selectors/Card';
import {deepEqual} from 'fast-equals';
import {useOnyxState} from 'react-native-onyx';

type CardListSelector<TReturn> = (cardList: CardList) => TReturn;

const dependencies = [ONYXKEYS.CARD_LIST, ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST] as const;

// useOnyxState runs the selector on every write to either key, so each selector's output is kept per merged list
const selectedValues = new WeakMap<CardListSelector<unknown>, {cardList: CardList; value: unknown}>();

function select<TReturn>(selector: CardListSelector<TReturn>, cardList: CardList): TReturn {
    const cached = selectedValues.get(selector);
    if (cached?.cardList === cardList) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- each entry only ever holds its own selector's output
        return cached.value as TReturn;
    }
    // One compare per selector shared by all consumers, so useOnyxState can compare outputs by identity
    const fresh = selector(cardList);
    const value = cached && deepEqual(cached.value, fresh) ? cached.value : fresh;
    selectedValues.set(selector, {cardList, value});
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- each entry only ever holds its own selector's output
    return value as TReturn;
}

// Pass a module-level selector: outputs are compared by identity, so a new selector each render returns a new object each render
function usePersonalAndWorkspaceCardList(): CardList;
function usePersonalAndWorkspaceCardList<TReturn>(selector: CardListSelector<TReturn>): TReturn;
function usePersonalAndWorkspaceCardList<TReturn>(selector?: CardListSelector<TReturn>) {
    return useOnyxState(
        (state) => {
            const cardList = personalAndWorkspaceCardListSelector(state[ONYXKEYS.CARD_LIST], state[ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST]);
            return selector ? select(selector, cardList) : cardList;
        },
        // Both the merge and select() return the previous object for equal content, so identity is enough
        {dependencies, selectorEquality: (a, b) => a === b},
    );
}

export default usePersonalAndWorkspaceCardList;
