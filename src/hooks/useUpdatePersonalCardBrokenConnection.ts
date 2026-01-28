import {useCallback} from 'react';
import {filterPersonalCards, getFeedConnectionBrokenCard} from '@libs/CardUtils';
import {updatePersonalCardConnection} from '@userActions/PersonalCards';
import ONYXKEYS from '@src/ONYXKEYS';
import type {CardList} from '@src/types/onyx';
import {getEmptyObject} from '@src/types/utils/EmptyObject';
import useOnyx from './useOnyx';

export default function useUpdatePersonalCardBrokenConnection() {
    const [cardList = getEmptyObject<CardList>()] = useOnyx(ONYXKEYS.CARD_LIST, {selector: filterPersonalCards, canBeMissing: true});
    const brokenCard = getFeedConnectionBrokenCard(cardList);
    const brokenCardId = brokenCard?.cardID?.toString();

    const updateBrokenConnection = useCallback(() => {
        if (!brokenCardId) {
            return;
        }
        updatePersonalCardConnection(brokenCardId, brokenCard?.lastScrapeResult);
    }, [brokenCard?.lastScrapeResult, brokenCardId]);

    return {updateBrokenConnection, isCardBroken: !!brokenCardId};
}
