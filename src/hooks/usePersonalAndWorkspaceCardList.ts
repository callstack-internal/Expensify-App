import ONYXKEYS from '@src/ONYXKEYS';
import type {CardList, WorkspaceCardsList} from '@src/types/onyx';

import type {OnyxCollection} from 'react-native-onyx';

import {personalAndWorkspaceCardListSelector} from '@selectors/Card';
import {useOnyxState} from 'react-native-onyx';

type CardListSelector<TReturn> = (cardList: CardList) => TReturn;

const dependencies = [ONYXKEYS.CARD_LIST, ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST];

// useOnyxState runs the selector on every write to either key, so each selector's output is kept per merged list
const selectedValues = new WeakMap<CardListSelector<unknown>, {cardList: CardList; value: unknown}>();

function select<TReturn>(selector: CardListSelector<TReturn>, cardList: CardList): TReturn {
    const cached = selectedValues.get(selector);
    if (cached?.cardList === cardList) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        return cached.value as TReturn;
    }
    const value = selector(cardList);
    selectedValues.set(selector, {cardList, value});
    return value;
}

function usePersonalAndWorkspaceCardList(): CardList;
function usePersonalAndWorkspaceCardList<TReturn>(selector: CardListSelector<TReturn>): TReturn;
function usePersonalAndWorkspaceCardList<TReturn>(selector?: CardListSelector<TReturn>) {
    return useOnyxState(
        (state) => {
            // useOnyxState's state view types a collection key as one member, but at runtime it returns the whole collection
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            const workspaceCardFeeds = state[ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST] as OnyxCollection<WorkspaceCardsList>;
            const cardList = personalAndWorkspaceCardListSelector(state[ONYXKEYS.CARD_LIST], workspaceCardFeeds);
            return selector ? select(selector, cardList) : cardList;
        },
        {dependencies},
    );
}

export default usePersonalAndWorkspaceCardList;
