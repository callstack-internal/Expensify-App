import React from 'react';
import type {StyleProp, TextStyle} from 'react-native';
import {View} from 'react-native';
import DisplayNames from '@components/DisplayNames';
import {useLHNListContext} from '@components/LHNOptionsList/LHNListContext';
import Text from '@components/Text';
import Tooltip from '@components/Tooltip';
import {useCurrentReportIDState} from '@hooks/useCurrentReportID';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import type {LHNOptionData} from '@hooks/useLHNOptionData';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';
import DateUtils from '@libs/DateUtils';
import {containsCustomEmoji as containsCustomEmojiUtils, containsOnlyCustomEmoji} from '@libs/EmojiUtils';
import FS from '@libs/Fullstory';
import {isChatUsedForOnboarding as isChatUsedForOnboardingReportUtils, isGroupChat, isHiddenForCurrentUser, isOneOnOneChat, isSystemChat} from '@libs/ReportUtils';
import TextWithEmojiFragment from '@pages/inbox/report/comment/TextWithEmojiFragment';
import FreeTrial from '@pages/settings/Subscription/FreeTrial';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import {isEmptyObject} from '@src/types/utils/EmptyObject';

type RowContentProps = {
    option: LHNOptionData;
    reportID: string;
    style?: StyleProp<TextStyle>;
    testID: number;
};

function RowContent({option, reportID, style, testID}: RowContentProps) {
    const styles = useThemeStyles();
    const StyleUtils = useStyleUtils();
    const {translate} = useLocalize();
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const {optionMode, isOptionFocusEnabled} = useLHNListContext();
    const {currentReportID} = useCurrentReportIDState();
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const [conciergeReportID] = useOnyx(ONYXKEYS.CONCIERGE_REPORT_ID);
    const [introSelected] = useOnyx(ONYXKEYS.NVP_INTRO_SELECTED);
    const [onboarding] = useOnyx(ONYXKEYS.NVP_ONBOARDING);
    const onboardingPurpose = introSelected?.choice;

    const isInFocusMode = optionMode === CONST.OPTION_MODE.COMPACT;
    const isOptionFocused = isOptionFocusEnabled && currentReportID === reportID;

    // Compute text styles
    const shouldBoldText = option.isUnread === true && option.notificationPreference !== CONST.REPORT.NOTIFICATION_PREFERENCE.MUTE && !isHiddenForCurrentUser(option.notificationPreference);
    const textStyle = isOptionFocused ? styles.sidebarLinkActiveText : styles.sidebarLinkText;
    const textUnreadStyle = shouldBoldText ? [textStyle, styles.sidebarLinkTextBold] : [textStyle];
    const displayNameStyle = [styles.optionDisplayName, styles.optionDisplayNameCompact, styles.pre, textUnreadStyle, styles.flexShrink0, style];
    const alternateTextStyle = isInFocusMode
        ? [textStyle, styles.textLabelSupporting, styles.optionAlternateTextCompact, styles.ml2, style]
        : [textStyle, styles.optionAlternateText, styles.textLabelSupporting, style];

    const isChatUsedForOnboarding = isChatUsedForOnboardingReportUtils(report, onboarding, conciergeReportID, onboardingPurpose);

    const shouldUseFullTitle =
        !!option.isChatRoom ||
        !!option.isPolicyExpenseChat ||
        !!option.isTaskReport ||
        !!option.isThread ||
        !!option.isMoneyRequestReport ||
        !!option.isInvoiceReport ||
        !!option.private_isArchived ||
        isGroupChat(report) ||
        isSystemChat(report);

    const shouldParseFullTitle = option?.parentReportAction?.actionName !== CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT && !isGroupChat(report);

    const emojiCode = option.status?.emojiCode ?? '';
    const statusText = option.status?.text ?? '';
    const statusClearAfterDate = option.status?.clearAfter ?? '';
    const currentSelectedTimezone = currentUserPersonalDetails?.timezone?.selected ?? CONST.DEFAULT_TIME_ZONE.selected;
    const formattedDate = DateUtils.getStatusUntilDate(translate, statusClearAfterDate, option?.timezone?.selected ?? CONST.DEFAULT_TIME_ZONE.selected, currentSelectedTimezone);
    const statusContent = formattedDate ? `${statusText ? `${statusText} ` : ''}(${formattedDate})` : statusText;
    const isStatusVisible = !!emojiCode && isOneOnOneChat(!isEmptyObject(report) ? report : undefined);

    const alternateTextContainsCustomEmojiWithText = containsCustomEmojiUtils(option?.alternateText) && !containsOnlyCustomEmoji(option?.alternateText);
    const alternateTextFSClass = FS.getChatFSClass(report);

    const contentContainerStyles = isInFocusMode ? [styles.flex1, styles.flexRow, styles.overflowHidden, StyleUtils.getCompactContentContainerStyles()] : [styles.flex1];

    return (
        <View style={contentContainerStyles}>
            <View style={[styles.flexRow, styles.alignItemsCenter, styles.mw100, styles.overflowHidden]}>
                <DisplayNames
                    accessibilityLabel={translate('accessibilityHints.chatUserDisplayNames')}
                    fullTitle={option.text ?? ''}
                    shouldParseFullTitle={shouldParseFullTitle}
                    displayNamesWithTooltips={option.displayNamesWithTooltips ?? []}
                    tooltipEnabled
                    numberOfLines={1}
                    textStyles={displayNameStyle}
                    shouldUseFullTitle={shouldUseFullTitle}
                    testID={testID}
                />
                {isChatUsedForOnboarding && <FreeTrial badgeStyles={[styles.mnh0, styles.pl2, styles.pr2, styles.ml1, styles.flexShrink1]} />}
                {isStatusVisible && (
                    <Tooltip
                        text={statusContent}
                        shiftVertical={-4}
                    >
                        <Text style={styles.ml1}>{emojiCode}</Text>
                    </Tooltip>
                )}
            </View>
            {!!option.alternateText && (
                <Text
                    style={alternateTextStyle}
                    numberOfLines={1}
                    accessibilityLabel={translate('accessibilityHints.lastChatMessagePreview')}
                    fsClass={alternateTextFSClass}
                >
                    {alternateTextContainsCustomEmojiWithText ? (
                        <TextWithEmojiFragment
                            message={option.alternateText}
                            style={[alternateTextStyle, styles.mh0]}
                            alignCustomEmoji
                        />
                    ) : (
                        option.alternateText
                    )}
                </Text>
            )}
        </View>
    );
}

RowContent.displayName = 'RowContent';

export default RowContent;
