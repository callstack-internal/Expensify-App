import useIsSearchRowFocused from '@components/Search/hooks/useIsSearchRowFocused';
import {useRowSelection} from '@components/Search/SearchSelectionProvider';
import ListItemComposed from '@components/SelectionList/ListItemComposed';
import type {ListItem} from '@components/SelectionList/types';

import useLayoutSpacing from '@hooks/useLayoutSpacing';
import {useReportName} from '@hooks/useReportAttributes';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';

import FS from '@libs/Fullstory';

import variables from '@styles/variables';

import ONYXKEYS from '@src/ONYXKEYS';

import React from 'react';
import {View} from 'react-native';

import type {TaskListItemProps, TaskListItemType} from './types';

import TaskListItemRow from './TaskListItemRow';

/**
 * A task row in search results showing date, title, description, creator, assignee,
 * and a complete/completed badge action.
 */
function TaskListItem<TItem extends ListItem>({
    item,
    showTooltip,
    isDisabled,
    canSelectMultiple,
    onSelectRow,
    onFocus,
    onLongPressRow,
    shouldSyncFocus,
    allReports,
    isLastItem,
}: TaskListItemProps<TItem>) {
    const isFocused = useIsSearchRowFocused(item.keyForList);
    const taskItem = item as unknown as TaskListItemType;
    const parentReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${taskItem?.parentReportID}`];
    const parentReportID = taskItem?.parentReportID;
    const liveParentReportAttributeName = useReportName(parentReportID);
    const liveTaskItem: TaskListItemType =
        liveParentReportAttributeName && liveParentReportAttributeName !== taskItem.parentReportName ? {...taskItem, parentReportName: liveParentReportAttributeName} : taskItem;
    const styles = useThemeStyles();
    const {pageGutterMargin} = useLayoutSpacing();
    const StyleUtils = useStyleUtils();

    const {isLargeScreenWidth} = useResponsiveLayout();
    const {isSelected} = useRowSelection(item.keyForList);

    const listItemPressableStyle = [
        styles.selectionListPressableItemWrapper,
        styles.pv3,
        styles.ph3,
        // Background is applied on the parent wrapper, so keep this transparent
        styles.bgTransparent,
        isSelected && styles.activeComponentBG,
        styles.mh0,
        isLargeScreenWidth && StyleUtils.getSearchTableRowPressableStyle(!!isLastItem, isSelected, {vertical: variables.tableRowPaddingVertical}),
    ];

    const listItemWrapperStyle = [
        styles.flex1,
        styles.userSelectNone,
        isLargeScreenWidth ? {...styles.flexRow, ...styles.justifyContentBetween, ...styles.alignItemsCenter} : {...styles.flexColumn, ...styles.alignItemsStretch},
    ];

    const fsClass = FS.getChatFSClass(parentReport);

    return (
        <ListItemComposed
            item={item}
            shouldAllowTextSelection
            pressableStyle={listItemPressableStyle}
            containerStyle={!isLargeScreenWidth && styles.mb2}
            isFocused={isFocused}
            isDisabled={isDisabled}
            shouldShowTooltip={showTooltip}
            canSelectMultiple={canSelectMultiple}
            onSelectRow={onSelectRow}
            onFocus={onFocus}
            onLongPressRow={onLongPressRow}
            shouldSyncFocus={shouldSyncFocus}
            hoverStyle={isSelected && styles.activeComponentBG}
            pressableWrapperStyle={[
                pageGutterMargin,
                StyleUtils.getSearchRowBackgroundStyle(isSelected),
                !isLargeScreenWidth && styles.br2,
                isLargeScreenWidth && isLastItem && [styles.tableBottomRadius, styles.overflowHidden],
            ]}
        >
            <View
                style={listItemWrapperStyle}
                fsClass={fsClass}
            >
                <TaskListItemRow
                    item={liveTaskItem}
                    showTooltip={showTooltip}
                />
            </View>
        </ListItemComposed>
    );
}

export default TaskListItem;
