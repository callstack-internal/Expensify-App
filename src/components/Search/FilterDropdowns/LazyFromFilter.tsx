import React, {useMemo} from 'react';
import {useOnyx} from 'react-native-onyx';
import UserSelectPopup from './UserSelectPopup';
import type {PopoverComponentProps} from './DropdownButton';
import type {SearchQueryJSON} from '@components/Search/types';
import {usePersonalDetails} from '@components/OnyxProvider';
import {mergeCardListWithWorkspaceFeeds} from '@libs/CardUtils';
import {getAllTaxRates} from '@libs/PolicyUtils';
import {buildFilterFormValuesFromQuery, buildQueryStringFromFilterFormValues} from '@libs/SearchQueryUtils';
import Navigation from '@libs/Navigation/Navigation';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

type LazyFromFilterProps = PopoverComponentProps & {
    queryJSON: SearchQueryJSON;
};

function LazyFromFilter({closeOverlay, queryJSON}: LazyFromFilterProps) {
    // Only load data when this component actually renders
    const personalDetails = usePersonalDetails();
    const [userCardList] = useOnyx(ONYXKEYS.CARD_LIST, {canBeMissing: true});
    const [reports] = useOnyx(ONYXKEYS.COLLECTION.REPORT, {canBeMissing: false});
    const [currencyList = {}] = useOnyx(ONYXKEYS.CURRENCY_LIST, {canBeMissing: true});
    const [policyTagsLists] = useOnyx(ONYXKEYS.COLLECTION.POLICY_TAGS, {canBeMissing: true});
    const [policyCategories] = useOnyx(ONYXKEYS.COLLECTION.POLICY_CATEGORIES, {canBeMissing: true});
    const [workspaceCardFeeds] = useOnyx(ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST, {canBeMissing: true});

    const taxRates = getAllTaxRates();
    const allCards = useMemo(() => mergeCardListWithWorkspaceFeeds(workspaceCardFeeds ?? CONST.EMPTY_OBJECT, userCardList), [userCardList, workspaceCardFeeds]);
    
    const filterFormValues = useMemo(() => {
        return buildFilterFormValuesFromQuery(queryJSON, policyCategories, policyTagsLists, currencyList, personalDetails, allCards, reports, taxRates);
    }, [allCards, currencyList, personalDetails, policyCategories, policyTagsLists, queryJSON, reports, taxRates]);

    const value = filterFormValues.from ?? [];

    return (
        <UserSelectPopup
            value={value}
            closeOverlay={closeOverlay}
            onChange={(selectedUsers) => {
                const newFilterFormValues = {...filterFormValues, from: selectedUsers};
                const queryString = buildQueryStringFromFilterFormValues(newFilterFormValues);
                Navigation.setParams({q: queryString});
            }}
        />
    );
}

LazyFromFilter.displayName = 'LazyFromFilter';

export default LazyFromFilter;