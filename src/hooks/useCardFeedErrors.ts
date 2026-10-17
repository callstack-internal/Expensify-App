import ONYXKEYS from '@src/ONYXKEYS';
import type {CardFeeds, WorkspaceCardsList} from '@src/types/onyx';
import type {CardFeedErrors} from '@src/types/onyx/DerivedValues';

import type {OnyxCollection} from 'react-native-onyx';

import {getCardFeedErrors} from '@selectors/CardFeedErrors';
import {useOnyxState} from 'react-native-onyx';

const CARD_FEED_ERRORS_DEPENDENCIES = [ONYXKEYS.CARD_LIST, ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST, ONYXKEYS.COLLECTION.SHARED_NVP_PRIVATE_DOMAIN_MEMBER, ONYXKEYS.CURRENT_DATE];

function useCardFeedErrors(): CardFeedErrors;
function useCardFeedErrors<TSelected>(selector: (cardFeedErrors: CardFeedErrors) => TSelected): TSelected;
function useCardFeedErrors<TSelected>(selector?: (cardFeedErrors: CardFeedErrors) => TSelected): CardFeedErrors | TSelected {
    return useOnyxState(
        (state) => {
            // useOnyxState's state view types a collection key as one member, but at runtime it returns the whole collection
            /* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
            const allWorkspaceCards = state[ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST] as OnyxCollection<WorkspaceCardsList>;
            const cardFeeds = state[ONYXKEYS.COLLECTION.SHARED_NVP_PRIVATE_DOMAIN_MEMBER] as OnyxCollection<CardFeeds>;
            /* eslint-enable @typescript-eslint/no-unsafe-type-assertion */
            const cardFeedErrors = getCardFeedErrors(state[ONYXKEYS.CARD_LIST], allWorkspaceCards, cardFeeds, state[ONYXKEYS.CURRENT_DATE]);
            return selector ? selector(cardFeedErrors) : cardFeedErrors;
        },
        {dependencies: CARD_FEED_ERRORS_DEPENDENCIES},
    );
}

export default useCardFeedErrors;
