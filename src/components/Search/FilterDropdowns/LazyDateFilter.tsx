import React, {useMemo} from 'react';
import {useOnyx} from 'react-native-onyx';
import DateSelectPopup from './DateSelectPopup';
import type {DateSelectPopupValue} from './DateSelectPopup';
import type {PopoverComponentProps} from './DropdownButton';
import type {SearchQueryJSON} from '@components/Search/types';
import {usePersonalDetails} from '@components/OnyxProvider';
import {mergeCardListWithWorkspaceFeeds} from '@libs/CardUtils';
import {getAllTaxRates} from '@libs/PolicyUtils';
import {buildFilterFormValuesFromQuery, buildQueryStringFromFilterFormValues, buildSearchQueryJSON, buildSearchQueryString} from '@libs/SearchQueryUtils';
import Navigation from '@libs/Navigation/Navigation';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

type LazyDateFilterProps = PopoverComponentProps & {
    queryJSON: SearchQueryJSON;
};

function LazyDateFilter({closeOverlay, queryJSON}: LazyDateFilterProps) {
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

    const value: DateSelectPopupValue = {
        [CONST.SEARCH.DATE_MODIFIERS.AFTER]: filterFormValues.dateAfter ?? null,
        [CONST.SEARCH.DATE_MODIFIERS.BEFORE]: filterFormValues.dateBefore ?? null,
        [CONST.SEARCH.DATE_MODIFIERS.ON]: filterFormValues.dateOn ?? null,
    };

    const onChange = (selectedDates: DateSelectPopupValue) => {
        const newFilterFormValues = {
            ...filterFormValues,
            ...queryJSON,
            dateAfter: selectedDates[CONST.SEARCH.DATE_MODIFIERS.AFTER] ?? undefined,
            dateBefore: selectedDates[CONST.SEARCH.DATE_MODIFIERS.BEFORE] ?? undefined,
            dateOn: selectedDates[CONST.SEARCH.DATE_MODIFIERS.ON] ?? undefined,
        };

        const filterString = buildQueryStringFromFilterFormValues(newFilterFormValues);
        const newJSON = buildSearchQueryJSON(filterString);
        const queryString = buildSearchQueryString(newJSON);

        Navigation.setParams({q: queryString});
    };

    return (
        <DateSelectPopup
            closeOverlay={closeOverlay}
            value={value}
            onChange={onChange}
        />
    );
}

LazyDateFilter.displayName = 'LazyDateFilter';

export default LazyDateFilter;