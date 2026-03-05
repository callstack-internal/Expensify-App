import reportsSelector from '@selectors/Attributes';
import React, {useRef, useState} from 'react';
import type {GestureResponderEvent, ViewStyle} from 'react-native';
import {StyleSheet, View} from 'react-native';
import Hoverable from '@components/Hoverable';
import LHNAvatar from '@components/LHNOptionsList/LHNAvatar';
import {useLHNListContext} from '@components/LHNOptionsList/LHNListContext';
import type {OptionRowLHNProps} from '@components/LHNOptionsList/types';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import {usePersonalDetails} from '@components/OnyxListItemProvider';
import PressableWithSecondaryInteraction from '@components/PressableWithSecondaryInteraction';
import {useCurrentReportIDState} from '@hooks/useCurrentReportID';
import useLHNOptionData from '@hooks/useLHNOptionData';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import DomUtils from '@libs/DomUtils';
import ReportActionComposeFocusManager from '@libs/ReportActionComposeFocusManager';
import {getDelegateAccountIDFromReportAction} from '@libs/ReportActionsUtils';
import {startSpan} from '@libs/telemetry/activeSpans';
import {showContextMenu} from '@pages/inbox/report/ContextMenu/ReportActionContextMenu';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import RowContent from './RowContent';
import RowIndicators from './RowIndicators';
import RowRBRIndicator from './RowRBRIndicator';
import RowTooltipWrapper from './RowTooltipWrapper';

function OptionRowLHN({reportID, onSelectRow = () => {}, style, onLayout = () => {}, testID}: OptionRowLHNProps) {
    const {isScreenFocused, optionMode, isOptionFocusEnabled} = useLHNListContext();
    const {currentReportID} = useCurrentReportIDState();
    const isOptionFocused = isOptionFocusEnabled && currentReportID === reportID;

    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const [reportAttributesDerived] = useOnyx(ONYXKEYS.DERIVED.REPORT_ATTRIBUTES, {selector: reportsSelector});
    const reportAttributes = reportAttributesDerived?.[reportID];

    const option = useLHNOptionData(reportID);

    const viewMode = optionMode;
    const theme = useTheme();
    const styles = useThemeStyles();
    const popoverAnchor = useRef<View>(null);
    const StyleUtils = useStyleUtils();
    const {shouldUseNarrowLayout} = useResponsiveLayout();

    const personalDetails = usePersonalDetails();

    const {translate} = useLocalize();
    const [isContextMenuActive, setIsContextMenuActive] = useState(false);
    const isInFocusMode = viewMode === CONST.OPTION_MODE.COMPACT;
    const sidebarInnerRowStyle = StyleSheet.flatten<ViewStyle>(
        isInFocusMode
            ? [styles.chatLinkRowPressable, styles.flexGrow1, styles.optionItemAvatarNameWrapper, styles.optionRowCompact, styles.justifyContentCenter]
            : [styles.chatLinkRowPressable, styles.flexGrow1, styles.optionItemAvatarNameWrapper, styles.optionRow, styles.justifyContentCenter],
    );

    const delegateAccountID = getDelegateAccountIDFromReportAction(option?.parentReportAction);

    // Match the header's delegate avatar logic: when a delegate exists on the
    // parent report action, the header (useReportActionAvatars) shows the
    // delegate's avatar as primary instead of the report owner's.
    const skipDelegate = report?.type === CONST.REPORT.TYPE.INVOICE || (option?.isTaskReport && !report?.chatReportID);
    const icons = (() => {
        let result = option?.icons ?? [];
        if (!skipDelegate && delegateAccountID && personalDetails && result.length > 0) {
            const delegateDetails = personalDetails[delegateAccountID];
            if (delegateDetails) {
                const updatedIcons = [...result];
                const firstIcon = updatedIcons.at(0);
                if (firstIcon) {
                    updatedIcons[0] = {
                        ...firstIcon,
                        source: delegateDetails.avatar ?? '',
                        name: delegateDetails.displayName ?? '',
                        id: delegateAccountID,
                    };
                }
                result = updatedIcons;
            }
        }

        return result;
    })();

    const delegateTooltipAccountID = (() => {
        if (!skipDelegate && delegateAccountID && personalDetails?.[delegateAccountID] && option?.icons?.length) {
            return Number(option.icons.at(0)?.id ?? CONST.DEFAULT_NUMBER_ID);
        }
        return undefined;
    })();

    const singleAvatarContainerStyle = [styles.actionAvatar, styles.mr3];

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

    const hoveredBackgroundColor = !!styles.sidebarLinkHover && 'backgroundColor' in styles.sidebarLinkHover ? styles.sidebarLinkHover.backgroundColor : theme.sidebar;
    const focusedBackgroundColor = styles.sidebarLinkActive.backgroundColor;
    const subscriptAvatarBorderColor = isOptionFocused ? focusedBackgroundColor : theme.sidebar;
    const firstIcon = option.icons?.at(0);

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
                isUnreadChat: !!option.isUnread,
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
                        {(hovered) => {
                            let secondaryAvatarBgColor = theme.sidebar;
                            if (isOptionFocused) {
                                secondaryAvatarBgColor = focusedBackgroundColor;
                            } else if (hovered) {
                                secondaryAvatarBgColor = hoveredBackgroundColor;
                            }
                            return (
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
                                    accessibilityLabel={`${translate('accessibilityHints.navigatesToChat')} ${option.text}. ${option.isUnread ? `${translate('common.unread')}.` : ''} ${option.alternateText}${brickRoadIndicator ? `. ${translate('common.yourReviewIsRequired')}` : ''}`}
                                    onLayout={onLayout}
                                    needsOffscreenAlphaCompositing={(option?.icons?.length ?? 0) >= 2}
                                    sentryLabel={CONST.SENTRY_LABEL.LHN.OPTION_ROW}
                                >
                                    <View style={sidebarInnerRowStyle}>
                                        <View style={[styles.flexRow, styles.alignItemsCenter]}>
                                            {!!option.icons?.length && !!firstIcon && (
                                                <LHNAvatar
                                                    icons={icons}
                                                    shouldShowSubscript={!!option.shouldShowSubscript}
                                                    size={isInFocusMode ? CONST.AVATAR_SIZE.SMALL : CONST.AVATAR_SIZE.DEFAULT}
                                                    subscriptAvatarBorderColor={hovered && !isOptionFocused ? hoveredBackgroundColor : subscriptAvatarBorderColor}
                                                    useMidSubscriptSize={isInFocusMode}
                                                    secondaryAvatarBackgroundColor={secondaryAvatarBgColor}
                                                    singleAvatarContainerStyle={singleAvatarContainerStyle}
                                                    shouldShowTooltip={!option.private_isArchived}
                                                    delegateAccountID={skipDelegate ? undefined : delegateAccountID}
                                                    delegateTooltipAccountID={delegateTooltipAccountID}
                                                />
                                            )}
                                            <RowContent
                                                reportID={reportID}
                                                style={style}
                                                testID={testID}
                                            />
                                            <RowRBRIndicator reportID={reportID} />
                                        </View>
                                    </View>
                                    <RowIndicators reportID={reportID} />
                                </PressableWithSecondaryInteraction>
                            );
                        }}
                    </Hoverable>
                </View>
            </RowTooltipWrapper>
        </OfflineWithFeedback>
    );
}

OptionRowLHN.displayName = 'OptionRowLHN';

export default OptionRowLHN;
