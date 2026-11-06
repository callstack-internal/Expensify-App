import useLocalize from '@hooks/useLocalize';
import usePersonalAndWorkspaceCardList from '@hooks/usePersonalAndWorkspaceCardList';

import {getCardDescription} from '@libs/CardUtils';

import {filterCardsHiddenFromSearch} from '@src/selectors/Card';

function useFilterCardValue(value: string[]): string {
    const {translate} = useLocalize();
    const searchCards = usePersonalAndWorkspaceCardList(filterCardsHiddenFromSearch);

    const cardNames = Object.values(searchCards ?? {})
        .filter((card) => value.includes(card.cardID.toString()))
        .map((card) => getCardDescription(card, translate));

    return cardNames.join(', ');
}

export default useFilterCardValue;
