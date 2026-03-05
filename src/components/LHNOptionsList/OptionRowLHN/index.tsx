import reportsSelector from '@selectors/Attributes';
import React, {useRef, useState} from 'react';
import type {GestureResponderEvent, ViewStyle} from 'react-native';
import {StyleSheet, View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import Hoverable from '@components/Hoverable';
import {useLHNListContext} from '@components/LHNOptionsList/LHNListContext';
import type {OptionRowLHNProps} from '@components/LHNOptionsList/types';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import PressableWithSecondaryInteraction from '@components/PressableWithSecondaryInteraction';
import {useCurrentReportIDState} from '@hooks/useCurrentReportID';
import useLHNIsUnread from '@hooks/useLHNIsUnread';
import useLHNOptionData from '@hooks/useLHNOptionData';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import DomUtils from '@libs/DomUtils';
import ReportActionComposeFocusManager from '@libs/ReportActionComposeFocusManager';
import {startSpan} from '@libs/telemetry/activeSpans';
import {showContextMenu} from '@pages/inbox/report/ContextMenu/ReportActionContextMenu';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report} from '@src/types/onyx';
import RowAvatar from './RowAvatar';
import RowContent from './RowContent';
import RowIndicators from './RowIndicators';
import RowRBRIndicator from './RowRBRIndicator';
import RowTooltipWrapper from './RowTooltipWrapper';

function reportSelector(report: OnyxEntry<Report>) {
    if (!report) {
        return undefined;
    }
    return {
        isPinned: report.isPinned,
        pendingFields: report.pendingFields,
    };
}

function OptionRowLHN({reportID, onSelectRow = () => {}, style, onLayout = () => {}, testID}: OptionRowLHNProps) {
    const {isScreenFocused, optionMode, isOptionFocusEnabled} = useLHNListContext();
    const {currentReportID} = useCurrentReportIDState();
    const isOptionFocused = isOptionFocusEnabled && currentReportID === reportID;

    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`, {selector: reportSelector});
    const [reportAttributesDerived] = useOnyx(ONYXKEYS.DERIVED.REPORT_ATTRIBUTES, {selector: reportsSelector});
    const reportAttributes = reportAttributesDerived?.[reportID];

    const option = useLHNOptionData(reportID);
    const isUnread = useLHNIsUnread(reportID);

    const viewMode = optionMode;
    const theme = useTheme();
    const styles = useThemeStyles();
    const popoverAnchor = useRef<View>(null);
    const StyleUtils = useStyleUtils();
    const {shouldUseNarrowLayout} = useResponsiveLayout();

    const {translate} = useLocalize();
    const [isContextMenuActive, setIsContextMenuActive] = useState(false);
    const isInFocusMode = viewMode === CONST.OPTION_MODE.COMPACT;
    const sidebarInnerRowStyle = StyleSheet.flatten<ViewStyle>(
        isInFocusMode
            ? [styles.chatLinkRowPressable, styles.flexGrow1, styles.optionItemAvatarNameWrapper, styles.optionRowCompact, styles.justifyContentCenter]
            : [styles.chatLinkRowPressable, styles.flexGrow1, styles.optionItemAvatarNameWrapper, styles.optionRow, styles.justifyContentCenter],
    );

    if (!option && !isOptionFocused) {
        return <View style={sidebarInnerRowStyle} />;
    }

    if (!option) {
        return null;
    }

    // Direct reads from report/reportAttributes
    const isPinned = report?.isPinned;
    const pendingAction = report?.pendingFields?.addWorkspaceRoom ?? report?.pendingFields?.createChat;
    const allReportErrors = reportAttributes?.reportErrors;
    const brickRoadIndicator = reportAttributes?.brickRoadStatus ?? undefined;

    const showPopover = (event: MouseEvent | GestureResponderEvent) => {
        if (!isScreenFocused && shouldUseNarrowLayout) {
            return;
        }
        setIsContextMenuActive(true);
        showContextMenu({
            type: CONST.CONTEXT_MENU_TYPES.REPORT,
            event,
            selection: '',
            contextMenuAnchor: popoverAnchor.current,
            report: {
                reportID,
                originalReportID: reportID,
                isPinnedChat: isPinned,
                isUnreadChat: isUnread,
            },
            reportAction: {
                reportActionID: '-1',
            },
            callbacks: {
                onHide: () => setIsContextMenuActive(false),
            },
            withoutOverlay: false,
        });
    };

    const onOptionPress = (event: GestureResponderEvent | KeyboardEvent | undefined) => {
        startSpan(`${CONST.TELEMETRY.SPAN_OPEN_REPORT}_${reportID}`, {
            name: 'OptionRowLHN',
            op: CONST.TELEMETRY.SPAN_OPEN_REPORT,
        });

        event?.preventDefault();
        ReportActionComposeFocusManager.focus();
        onSelectRow(reportID);
    };

    return (
        <OfflineWithFeedback
            pendingAction={pendingAction}
            errors={allReportErrors}
            shouldShowErrorMessages={false}
            needsOffscreenAlphaCompositing
        >
            <RowTooltipWrapper
                reportID={reportID}
                onOptionPress={onOptionPress}
            >
                <View>
                    <Hoverable>
                        {(hovered) => (
                            <PressableWithSecondaryInteraction
                                ref={popoverAnchor}
                                onPress={onOptionPress}
                                onMouseDown={(event) => {
                                    if (!event) {
                                        return;
                                    }
                                    event.preventDefault();
                                }}
                                testID={reportID}
                                onSecondaryInteraction={(event) => {
                                    showPopover(event);
                                    if (DomUtils.getActiveElement()) {
                                        (DomUtils.getActiveElement() as HTMLElement | null)?.blur();
                                    }
                                }}
                                withoutFocusOnSecondaryInteraction
                                activeOpacity={variables.pressDimValue}
                                opacityAnimationDuration={0}
                                style={[
                                    styles.flexRow,
                                    styles.alignItemsCenter,
                                    styles.justifyContentBetween,
                                    styles.sidebarLink,
                                    styles.sidebarLinkInnerLHN,
                                    StyleUtils.getBackgroundColorStyle(theme.sidebar),
                                    isOptionFocused ? styles.sidebarLinkActive : null,
                                    (hovered || isContextMenuActive) && !isOptionFocused ? styles.sidebarLinkHover : null,
                                ]}
                                role={CONST.ROLE.BUTTON}
                                accessibilityLabel={`${translate('accessibilityHints.navigatesToChat')} ${option.text}. ${isUnread ? `${translate('common.unread')}.` : ''} ${option.alternateText}${brickRoadIndicator ? `. ${translate('common.yourReviewIsRequired')}` : ''}`}
                                onLayout={onLayout}
                                needsOffscreenAlphaCompositing={(option?.icons?.length ?? 0) >= 2}
                                sentryLabel={CONST.SENTRY_LABEL.LHN.OPTION_ROW}
                            >
                                <View style={sidebarInnerRowStyle}>
                                    <View style={[styles.flexRow, styles.alignItemsCenter]}>
                                        <RowAvatar
                                            reportID={reportID}
                                            hovered={hovered}
                                            icons={option.icons ?? []}
                                        />
                                        <RowContent
                                            reportID={reportID}
                                            text={option.text}
                                            alternateText={option.alternateText}
                                            style={style}
                                            testID={testID}
                                        />
                                        <RowRBRIndicator reportID={reportID} />
                                    </View>
                                </View>
                                <RowIndicators reportID={reportID} />
                            </PressableWithSecondaryInteraction>
                        )}
                    </Hoverable>
                </View>
            </RowTooltipWrapper>
        </OfflineWithFeedback>
    );
}

OptionRowLHN.displayName = 'OptionRowLHN';

export default OptionRowLHN;
