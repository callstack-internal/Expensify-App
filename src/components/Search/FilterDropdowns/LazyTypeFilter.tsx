import React from 'react';
import {useOnyx} from 'react-native-onyx';
import SingleSelectPopup from './SingleSelectPopup';
import type {SingleSelectItem} from './SingleSelectPopup';
import type {PopoverComponentProps} from './DropdownButton';
import type {SearchDataTypes} from '@src/types/onyx/SearchResults';
import {canSendInvoice} from '@libs/PolicyUtils';
import {hasInvoiceReports} from '@libs/ReportUtils';
import {buildSearchQueryString} from '@libs/SearchQueryUtils';
import Navigation from '@libs/Navigation/Navigation';
import useLocalize from '@hooks/useLocalize';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {SearchQueryJSON} from '@components/Search/types';

type LazyTypeFilterProps = PopoverComponentProps & {
    queryJSON: SearchQueryJSON;
};

const typeOptions: Array<SingleSelectItem<SearchDataTypes>> = [
    {translation: 'common.expense', value: CONST.SEARCH.DATA_TYPES.EXPENSE},
    {translation: 'common.chat', value: CONST.SEARCH.DATA_TYPES.CHAT},
    {translation: 'common.invoice', value: CONST.SEARCH.DATA_TYPES.INVOICE},
    {translation: 'common.trip', value: CONST.SEARCH.DATA_TYPES.TRIP},
    {translation: 'common.task', value: CONST.SEARCH.DATA_TYPES.TASK},
];

function LazyTypeFilter({closeOverlay, queryJSON}: LazyTypeFilterProps) {
    const {translate} = useLocalize();
    const {type, groupBy, status} = queryJSON;
    
    // Only load data when this component actually renders
    const [allPolicies] = useOnyx(ONYXKEYS.COLLECTION.POLICY, {canBeMissing: true});
    const [session] = useOnyx(ONYXKEYS.SESSION, {canBeMissing: true});
    
    const value = typeOptions.find((option) => option.value === type) ?? null;

    const onChange = (item: SingleSelectItem<SearchDataTypes> | null) => {
        const hasTypeChanged = item?.value !== type;
        const newType = item?.value ?? CONST.SEARCH.DATA_TYPES.EXPENSE;
        // If the type has changed, reset the status so we dont have an invalid status selected
        const newStatus = hasTypeChanged ? CONST.SEARCH.STATUS.EXPENSE.ALL : status;
        const newGroupBy = hasTypeChanged ? undefined : groupBy;
        const query = buildSearchQueryString({...queryJSON, type: newType, status: newStatus, groupBy: newGroupBy});
        Navigation.setParams({q: query});
    };

    // Remove the invoice option if the user is not allowed to send invoices
    let visibleOptions = typeOptions;
    if (!canSendInvoice(allPolicies, session?.email) && !hasInvoiceReports()) {
        visibleOptions = visibleOptions.filter((typeOption) => typeOption.value !== CONST.SEARCH.DATA_TYPES.INVOICE);
    }

    return (
        <SingleSelectPopup
            label={translate('common.type')}
            value={value}
            items={visibleOptions}
            closeOverlay={closeOverlay}
            onChange={onChange}
        />
    );
}

LazyTypeFilter.displayName = 'LazyTypeFilter';

export default LazyTypeFilter;