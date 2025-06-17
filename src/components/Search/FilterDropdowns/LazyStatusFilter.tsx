import React from 'react';
import MultiSelectPopup from './MultiSelectPopup';
import type {MultiSelectItem} from './MultiSelectPopup';
import type {PopoverComponentProps} from './DropdownButton';
import type {SearchGroupBy, SearchQueryJSON, SingularSearchStatus} from '@components/Search/types';
import {buildSearchQueryString} from '@libs/SearchQueryUtils';
import Navigation from '@libs/Navigation/Navigation';
import useLocalize from '@hooks/useLocalize';
import CONST from '@src/CONST';

type LazyStatusFilterProps = PopoverComponentProps & {
    queryJSON: SearchQueryJSON;
};

const expenseStatusOptions: Array<MultiSelectItem<SingularSearchStatus>> = [
    {translation: 'common.unreported', value: CONST.SEARCH.STATUS.EXPENSE.UNREPORTED},
    {translation: 'common.drafts', value: CONST.SEARCH.STATUS.EXPENSE.DRAFTS},
    {translation: 'common.outstanding', value: CONST.SEARCH.STATUS.EXPENSE.OUTSTANDING},
    {translation: 'iou.approved', value: CONST.SEARCH.STATUS.EXPENSE.APPROVED},
    {translation: 'iou.settledExpensify', value: CONST.SEARCH.STATUS.EXPENSE.PAID},
    {translation: 'iou.done', value: CONST.SEARCH.STATUS.EXPENSE.DONE},
];

const expenseReportStatusOptions: Array<MultiSelectItem<SingularSearchStatus>> = [
    {translation: 'common.drafts', value: CONST.SEARCH.STATUS.EXPENSE.DRAFTS},
    {translation: 'common.outstanding', value: CONST.SEARCH.STATUS.EXPENSE.OUTSTANDING},
    {translation: 'iou.approved', value: CONST.SEARCH.STATUS.EXPENSE.APPROVED},
    {translation: 'iou.settledExpensify', value: CONST.SEARCH.STATUS.EXPENSE.PAID},
    {translation: 'iou.done', value: CONST.SEARCH.STATUS.EXPENSE.DONE},
];

const chatStatusOptions: Array<MultiSelectItem<SingularSearchStatus>> = [
    {translation: 'common.unread', value: CONST.SEARCH.STATUS.CHAT.UNREAD},
    {translation: 'common.sent', value: CONST.SEARCH.STATUS.CHAT.SENT},
    {translation: 'common.attachments', value: CONST.SEARCH.STATUS.CHAT.ATTACHMENTS},
    {translation: 'common.links', value: CONST.SEARCH.STATUS.CHAT.LINKS},
    {translation: 'search.filters.pinned', value: CONST.SEARCH.STATUS.CHAT.PINNED},
];

const invoiceStatusOptions: Array<MultiSelectItem<SingularSearchStatus>> = [
    {translation: 'common.outstanding', value: CONST.SEARCH.STATUS.INVOICE.OUTSTANDING},
    {translation: 'iou.settledExpensify', value: CONST.SEARCH.STATUS.INVOICE.PAID},
];

const tripStatusOptions: Array<MultiSelectItem<SingularSearchStatus>> = [
    {translation: 'search.filters.current', value: CONST.SEARCH.STATUS.TRIP.CURRENT},
    {translation: 'search.filters.past', value: CONST.SEARCH.STATUS.TRIP.PAST},
];

const taskStatusOptions: Array<MultiSelectItem<SingularSearchStatus>> = [
    {translation: 'common.outstanding', value: CONST.SEARCH.STATUS.TASK.OUTSTANDING},
    {translation: 'search.filters.completed', value: CONST.SEARCH.STATUS.TASK.COMPLETED},
];

function getStatusOptions(type: string, groupBy: SearchGroupBy | undefined) {
    switch (type) {
        case CONST.SEARCH.DATA_TYPES.CHAT:
            return chatStatusOptions;
        case CONST.SEARCH.DATA_TYPES.INVOICE:
            return invoiceStatusOptions;
        case CONST.SEARCH.DATA_TYPES.TRIP:
            return tripStatusOptions;
        case CONST.SEARCH.DATA_TYPES.TASK:
            return taskStatusOptions;
        case CONST.SEARCH.DATA_TYPES.EXPENSE:
        default:
            return groupBy === CONST.SEARCH.GROUP_BY.REPORTS ? expenseReportStatusOptions : expenseStatusOptions;
    }
}

function LazyStatusFilter({closeOverlay, queryJSON}: LazyStatusFilterProps) {
    const {translate} = useLocalize();
    const {type, groupBy, status} = queryJSON;
    
    const items = getStatusOptions(type, groupBy);
    const selected = Array.isArray(status) ? items.filter((option) => status.includes(option.value)) : (items.find((option) => option.value === status) ?? []);
    const value = [selected].flat();

    const onChange = (selectedItems: Array<MultiSelectItem<SingularSearchStatus>>) => {
        const newStatus = selectedItems.length ? selectedItems.map((i) => i.value) : CONST.SEARCH.STATUS.EXPENSE.ALL;
        const query = buildSearchQueryString({...queryJSON, status: newStatus});
        Navigation.setParams({q: query});
    };

    return (
        <MultiSelectPopup
            label={translate('common.status')}
            items={items}
            value={value}
            closeOverlay={closeOverlay}
            onChange={onChange}
        />
    );
}

LazyStatusFilter.displayName = 'LazyStatusFilter';

export default LazyStatusFilter;