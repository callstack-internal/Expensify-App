import React, {useCallback, useMemo, useRef} from 'react';
import {View} from 'react-native';
// eslint-disable-next-line no-restricted-imports
import type {ScrollView as RNScrollView} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import Button from '@components/Button';
import ButtonWithDropdownMenu from '@components/ButtonWithDropdownMenu';
import type {DropdownOption} from '@components/ButtonWithDropdownMenu/types';
import * as Expensicons from '@components/Icon/Expensicons';
import ScrollView from '@components/ScrollView';
import DropdownButton from '@components/Search/FilterDropdowns/DropdownButton';
import {useSearchContext} from '@components/Search/SearchContext';
import type {SearchQueryJSON} from '@components/Search/types';
import SearchFiltersSkeleton from '@components/Skeletons/SearchFiltersSkeleton';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {SearchHeaderOptionValue} from './SearchPageHeader';

type SearchFiltersBarProps = {
    queryJSON: SearchQueryJSON;
    headerButtonsOptions: Array<DropdownOption<SearchHeaderOptionValue>>;
};


function SearchFiltersBar({queryJSON, headerButtonsOptions}: SearchFiltersBarProps) {
    const {hash, type, groupBy, status} = queryJSON;
    const scrollRef = useRef<RNScrollView>(null);

    const theme = useTheme();
    const styles = useThemeStyles();
    const {translate} = useLocalize();

    const {isOffline} = useNetwork();
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const {selectedTransactions, setExportMode, isExportMode, shouldShowExportModeOption, shouldShowFiltersBarLoading} = useSearchContext();

    // Only load basic data needed for selection dropdown and error states
    const [selectionMode] = useOnyx(ONYXKEYS.MOBILE_SELECTION_MODE, {canBeMissing: true});
    const [currentSearchResults] = useOnyx(`${ONYXKEYS.COLLECTION.SNAPSHOT}${hash}`, {canBeMissing: true});

    // Basic state for determining dropdown vs filters view - always computed
    const hasErrors = Object.keys(currentSearchResults?.errors ?? {}).length > 0 && !isOffline;
    const shouldShowSelectedDropdown = headerButtonsOptions.length > 0 && (!shouldUseNarrowLayout || (!!selectionMode && selectionMode.isEnabled));
    const selectedTransactionsKeys = useMemo(() => Object.keys(selectedTransactions ?? {}), [selectedTransactions]);

    const openAdvancedFilters = useCallback(() => {
        // Advanced filters will load their own data when needed
        Navigation.navigate(ROUTES.SEARCH_ADVANCED_FILTERS);
    }, []);

    // Create simple filter buttons that load data only when clicked
    const filters = useMemo(() => [
        {
            label: translate('common.type'),
            value: null, // We'll determine values when clicked
            filterType: 'type' as const,
        },
        {
            label: translate('common.status'),
            value: null,
            filterType: 'status' as const,
        },
        {
            label: translate('common.date'),
            value: null,
            filterType: 'date' as const,
        },
        {
            label: translate('common.from'),
            value: null,
            filterType: 'from' as const,
        },
    ], [translate]);

    if (hasErrors) {
        return null;
    }

    if (shouldShowFiltersBarLoading) {
        return <SearchFiltersSkeleton shouldAnimate />;
    }

    const selectionButtonText = isExportMode ? translate('search.exportAll.allMatchingItemsSelected') : translate('workspace.common.selected', {count: selectedTransactionsKeys.length});

    return (
        <View style={[shouldShowSelectedDropdown && styles.ph5, styles.mb2, styles.searchFiltersBarContainer]}>
            {shouldShowSelectedDropdown ? (
                <View style={[styles.flexRow, styles.gap3]}>
                    <ButtonWithDropdownMenu
                        onPress={() => null}
                        shouldAlwaysShowDropdownMenu
                        buttonSize={CONST.DROPDOWN_BUTTON_SIZE.SMALL}
                        customText={selectionButtonText}
                        options={headerButtonsOptions}
                        isSplitButton={false}
                        anchorAlignment={{
                            horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.LEFT,
                            vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.TOP,
                        }}
                        popoverHorizontalOffsetType={CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.LEFT}
                    />
                    {!isExportMode && shouldShowExportModeOption && (
                        <Button
                            link
                            small
                            shouldUseDefaultHover={false}
                            innerStyles={styles.p0}
                            onPress={() => setExportMode(true)}
                            text={translate('search.exportAll.selectAllMatchingItems')}
                        />
                    )}
                </View>
            ) : (
                <ScrollView
                    horizontal
                    keyboardShouldPersistTaps="always"
                    style={[styles.flexRow, styles.overflowScroll, styles.flexGrow0]}
                    contentContainerStyle={[styles.flexRow, styles.flexGrow0, styles.gap2, styles.ph5]}
                    ref={scrollRef}
                    showsHorizontalScrollIndicator={false}
                >
                    {filters.map((filter) => (
                        <DropdownButton
                            key={filter.label}
                            label={filter.label}
                            value={filter.value}
                            filterType={filter.filterType}
                            queryJSON={queryJSON}
                        />
                    ))}

                    <Button
                        link
                        small
                        shouldUseDefaultHover={false}
                        text={translate('search.filtersHeader')}
                        iconFill={theme.link}
                        iconHoverFill={theme.linkHover}
                        icon={Expensicons.Filter}
                        textStyles={[styles.textMicroBold]}
                        onPress={openAdvancedFilters}
                    />
                </ScrollView>
            )}
        </View>
    );
}

SearchFiltersBar.displayName = 'SearchFiltersBar';

export default SearchFiltersBar;
