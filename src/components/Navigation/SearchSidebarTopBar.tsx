import React from 'react';
import {useSearchStateContext} from '@components/Search/SearchContext';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import SCREENS from '@src/SCREENS';
import TopBar from './TopBar';

type SearchSidebarTopBarProps = {
    routeName: string | undefined;
};

function SearchSidebarTopBar({routeName}: SearchSidebarTopBarProps) {
    const {translate} = useLocalize();
    const {isOffline} = useNetwork();
    const {currentSearchResults} = useSearchStateContext();
    const isSearchLoading = currentSearchResults?.search?.isLoading;
    const shouldShowLoadingState = routeName === SCREENS.RIGHT_MODAL.SEARCH_MONEY_REQUEST_REPORT ? false : !isOffline && !!isSearchLoading;

    return (
        <TopBar
            shouldShowLoadingBar={shouldShowLoadingState}
            breadcrumbLabel={translate('common.reports')}
            shouldDisplaySearch={false}
            shouldDisplayHelpButton={false}
        />
    );
}

export default SearchSidebarTopBar;
