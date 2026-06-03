/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {useIsFocused, useRoute} from '@react-navigation/native';
import reportsSelector from '@selectors/Attributes';
import type {FlashListProps, FlashListRef} from '@shopify/flash-list';
import {FlashList} from '@shopify/flash-list';
import type {ReactElement} from 'react';
import React, {useContext, useEffect, useRef} from 'react';
import {StyleSheet, View} from 'react-native';
import {ScrollOffsetContext} from '@components/ScrollOffsetContextProvider';
import useOnyx from '@hooks/useOnyx';
import usePrevious from '@hooks/usePrevious';
import useRootNavigationState from '@hooks/useRootNavigationState';
import useScrollEventEmitter from '@hooks/useScrollEventEmitter';
import useThemeStyles from '@hooks/useThemeStyles';
import getPlatform from '@libs/getPlatform';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import NAVIGATORS from '@src/NAVIGATORS';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report} from '@src/types/onyx';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import {LHNListContext} from './LHNListContext';
import OptionRowLHN from './OptionRowLHN';
import OptionRowRendererComponent from './OptionRowRendererComponent';
import type {LHNOptionsListProps, RenderItemProps} from './types';

const keyExtractor = (item: Report) => `report_${item.reportID}`;
const platform = getPlatform();
const isWeb = platform === CONST.PLATFORM.WEB;

function LHNOptionsList({style, contentContainerStyles, data, onSelectRow, optionMode, shouldDisableFocusOptions = false, onFirstItemRendered = () => {}}: LHNOptionsListProps) {
    const {saveScrollOffset, getScrollOffset, saveScrollIndex, getScrollIndex} = useContext(ScrollOffsetContext);
    const flashListRef = useRef<FlashListRef<Report>>(null);
    const route = useRoute();
    const isScreenFocused = useIsFocused();

    const [reportAttributes] = useOnyx(ONYXKEYS.DERIVED.REPORT_ATTRIBUTES, {selector: reportsSelector});

    const styles = useThemeStyles();
    const isReportsSplitNavigatorLast = useRootNavigationState((state) => state?.routes?.at(-1)?.name === NAVIGATORS.REPORTS_SPLIT_NAVIGATOR);
    const estimatedItemSize = optionMode === CONST.OPTION_MODE.COMPACT ? variables.optionRowHeightCompact : variables.optionRowHeight;

    const firstReportIDWithGBRorRBR = (() => {
        const firstReportWithGBRorRBR = data.find((report) => {
            const itemReportErrors = reportAttributes?.[report.reportID]?.reportErrors;
            if (!report) {
                return false;
            }
            if (!isEmptyObject(itemReportErrors)) {
                return true;
            }
            const hasGBR = reportAttributes?.[report.reportID]?.requiresAttention;
            return hasGBR;
        });

        return firstReportWithGBRorRBR?.reportID;
    })();

    // When the first item renders we want to call the onFirstItemRendered callback.
    const hasCalledOnLayout = React.useRef(false);
    const onLayoutItem = () => {
        if (hasCalledOnLayout.current) {
            return;
        }
        hasCalledOnLayout.current = true;
        onFirstItemRendered();
    };

    // Controls the visibility of the educational tooltip based on user scrolling.
    const triggerScrollEvent = useScrollEventEmitter();

    const lhnListContextValue = {
        isReportsSplitNavigatorLast,
        isScreenFocused,
        optionMode,
        isOptionFocusEnabled: !shouldDisableFocusOptions,
        firstReportIDWithGBRorRBR,
    };

    /**
     * Function which renders a row in the list
     */
    const renderItem = ({item, index}: RenderItemProps): ReactElement => {
        return (
            <OptionRowLHN
                reportID={item.reportID}
                onSelectRow={onSelectRow}
                onLayout={onLayoutItem}
                testID={index}
            />
        );
    };

    const extraData = [reportAttributes, data.length, optionMode, isScreenFocused, isReportsSplitNavigatorLast];

    const previousOptionMode = usePrevious(optionMode);

    useEffect(() => {
        if (previousOptionMode === null || previousOptionMode === optionMode || !flashListRef.current) {
            return;
        }

        // If the option mode changes want to scroll to the top of the list because rendered items will have different height.
        flashListRef.current.scrollToOffset({offset: 0});
    }, [previousOptionMode, optionMode]);

    const onScroll = (e: Parameters<NonNullable<FlashListProps<string>['onScroll']>>[0]) => {
        // If the layout measurement is 0, it means the FlashList is not displayed but the onScroll may be triggered with offset value 0.
        // We should ignore this case.
        if (e.nativeEvent.layoutMeasurement.height === 0) {
            return;
        }
        saveScrollOffset(route, e.nativeEvent.contentOffset.y);
        if (isWeb) {
            saveScrollIndex(route, Math.floor(e.nativeEvent.contentOffset.y / estimatedItemSize));
        }
        triggerScrollEvent();
    };

    const onLayout = () => {
        const offset = getScrollOffset(route);

        if (!(offset && flashListRef.current) || isWeb) {
            return;
        }

        // We need to use requestAnimationFrame to make sure it will scroll properly on iOS.
        requestAnimationFrame(() => {
            if (!(offset && flashListRef.current)) {
                return;
            }
            flashListRef.current.scrollToOffset({offset});
        });
    };

    return (
        <View style={style ?? styles.flex1}>
            <LHNListContext.Provider value={lhnListContextValue}>
                <FlashList
                    ref={flashListRef}
                    indicatorStyle="white"
                    keyboardShouldPersistTaps="always"
                    CellRendererComponent={OptionRowRendererComponent}
                    contentContainerStyle={StyleSheet.flatten(contentContainerStyles)}
                    data={data}
                    testID="lhn-options-list"
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    extraData={extraData}
                    showsVerticalScrollIndicator={false}
                    onLayout={onLayout}
                    onScroll={onScroll}
                    initialScrollIndex={isWeb ? getScrollIndex(route) : undefined}
                    maintainVisibleContentPosition={{disabled: true}}
                    drawDistance={250}
                    removeClippedSubviews
                />
            </LHNListContext.Provider>
        </View>
    );
}

export default LHNOptionsList;
