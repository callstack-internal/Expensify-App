import type {ParamListBase} from '@react-navigation/native';
import React from 'react';
import {View} from 'react-native';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import type {PlatformStackNavigationState} from '@libs/Navigation/PlatformStackNavigation/types';
import type {SearchFullscreenNavigatorParamList} from '@libs/Navigation/types';
import {buildSearchQueryJSON} from '@libs/SearchQueryUtils';
import SearchTypeMenu from '@pages/Search/SearchTypeMenu';
import type SCREENS from '@src/SCREENS';
import NavigationTabBar from './NavigationTabBar';
import NAVIGATION_TABS from './NavigationTabBar/NAVIGATION_TABS';
import SearchSidebarTopBar from './SearchSidebarTopBar';

type SearchSidebarProps = {
    state: PlatformStackNavigationState<ParamListBase>;
};

function SearchSidebar({state}: SearchSidebarProps) {
    const styles = useThemeStyles();
    const {shouldUseNarrowLayout} = useResponsiveLayout();

    const route = state.routes.at(-1);
    const params = route?.params as SearchFullscreenNavigatorParamList[typeof SCREENS.SEARCH.ROOT] | undefined;
    const queryJSON = params?.q ? buildSearchQueryJSON(params.q, params.rawQuery) : undefined;

    if (shouldUseNarrowLayout) {
        return null;
    }

    return (
        <View style={styles.searchSidebar}>
            <View style={styles.flex1}>
                <SearchSidebarTopBar routeName={route?.name} />
                <SearchTypeMenu queryJSON={queryJSON} />
            </View>
            <NavigationTabBar selectedTab={NAVIGATION_TABS.SEARCH} />
        </View>
    );
}

export default SearchSidebar;
