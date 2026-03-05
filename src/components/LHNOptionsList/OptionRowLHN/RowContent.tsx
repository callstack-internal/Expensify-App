import React from 'react';
import type {StyleProp, TextStyle} from 'react-native';
import {View} from 'react-native';
import DisplayNames from '@components/DisplayNames';
import {useLHNListContext} from '@components/LHNOptionsList/LHNListContext';
import Text from '@components/Text';
import Tooltip from '@components/Tooltip';
import {useCurrentReportIDState} from '@hooks/useCurrentReportID';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useLHNOptionData from '@hooks/useLHNOptionData';
import useLHNReportStatus from '@hooks/useLHNReportStatus';
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
    reportID: string;
    style?: StyleProp<TextStyle>;
    testID: number;
};

function RowOnboardingBadge({reportID}: {reportID: string}) {
    const styles = useThemeStyles();
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const [conciergeReportID] = useOnyx(ONYXKEYS.CONCIERGE_REPORT_ID);
    const [introSelected] = useOnyx(ONYXKEYS.NVP_INTRO_SELECTED);
    const [onboarding] = useOnyx(ONYXKEYS.NVP_ONBOARDING);

    if (!isChatUsedForOnboardingReportUtils(report, onboarding, conciergeReportID, introSelected?.choice)) {
        return null;
    }

    return <FreeTrial badgeStyles={[styles.mnh0, styles.pl2, styles.pr2, styles.ml1, styles.flexShrink1]} />;
}

function RowStatusEmoji({reportID}: {reportID: string}) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const {status, timezone} = useLHNReportStatus(reportID);

    const emojiCode = status?.emojiCode ?? '';

    if (!emojiCode || !isOneOnOneChat(!isEmptyObject(report) ? report : undefined)) {
        return null;
    }

    const statusText = status?.text ?? '';
    const statusClearAfterDate = status?.clearAfter ?? '';
    const currentSelectedTimezone = currentUserPersonalDetails?.timezone?.selected ?? CONST.DEFAULT_TIME_ZONE.selected;
    const formattedDate = DateUtils.getStatusUntilDate(translate, statusClearAfterDate, timezone?.selected ?? CONST.DEFAULT_TIME_ZONE.selected, currentSelectedTimezone);
    const statusContent = formattedDate ? `${statusText ? `${statusText} ` : ''}(${formattedDate})` : statusText;

    return (
        <Tooltip
            text={statusContent}
            shiftVertical={-4}
        >
            <Text style={styles.ml1}>{emojiCode}</Text>
        </Tooltip>
    );
}

function RowAlternateText({reportID, text, style}: {reportID: string; text: string | undefined; style?: StyleProp<TextStyle>}) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const {optionMode, isOptionFocusEnabled} = useLHNListContext();
    const {currentReportID} = useCurrentReportIDState();
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const option = useLHNOptionData(reportID);

    if (!text) {
        return null;
    }

    const isInFocusMode = optionMode === CONST.OPTION_MODE.COMPACT;
    const isOptionFocused = isOptionFocusEnabled && currentReportID === reportID;
    const shouldBoldText = option?.isUnread === true && option.notificationPreference !== CONST.REPORT.NOTIFICATION_PREFERENCE.MUTE && !isHiddenForCurrentUser(option.notificationPreference);
    const textStyle = isOptionFocused ? styles.sidebarLinkActiveText : styles.sidebarLinkText;
    const alternateTextStyle = isInFocusMode
        ? [shouldBoldText ? [textStyle, styles.sidebarLinkTextBold] : textStyle, styles.textLabelSupporting, styles.optionAlternateTextCompact, styles.ml2, style]
        : [shouldBoldText ? [textStyle, styles.sidebarLinkTextBold] : textStyle, styles.optionAlternateText, styles.textLabelSupporting, style];

    const alternateTextContainsCustomEmojiWithText = containsCustomEmojiUtils(text) && !containsOnlyCustomEmoji(text);
    const alternateTextFSClass = FS.getChatFSClass(report);

    return (
        <Text
            style={alternateTextStyle}
            numberOfLines={1}
            accessibilityLabel={translate('accessibilityHints.lastChatMessagePreview')}
            fsClass={alternateTextFSClass}
        >
            {alternateTextContainsCustomEmojiWithText ? (
                <TextWithEmojiFragment
                    message={text}
                    style={[alternateTextStyle, styles.mh0]}
                    alignCustomEmoji
                />
            ) : (
                text
            )}
        </Text>
    );
}

function RowContent({reportID, style, testID}: RowContentProps) {
    const styles = useThemeStyles();
    const StyleUtils = useStyleUtils();
    const {translate} = useLocalize();
    const {optionMode, isOptionFocusEnabled} = useLHNListContext();
    const {currentReportID} = useCurrentReportIDState();
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const option = useLHNOptionData(reportID);

    const isInFocusMode = optionMode === CONST.OPTION_MODE.COMPACT;
    const isOptionFocused = isOptionFocusEnabled && currentReportID === reportID;

    const shouldBoldText = option?.isUnread === true && option.notificationPreference !== CONST.REPORT.NOTIFICATION_PREFERENCE.MUTE && !isHiddenForCurrentUser(option.notificationPreference);
    const textStyle = isOptionFocused ? styles.sidebarLinkActiveText : styles.sidebarLinkText;
    const textUnreadStyle = shouldBoldText ? [textStyle, styles.sidebarLinkTextBold] : [textStyle];
    const displayNameStyle = [styles.optionDisplayName, styles.optionDisplayNameCompact, styles.pre, textUnreadStyle, styles.flexShrink0, style];

    const shouldUseFullTitle =
        !!option?.isChatRoom ||
        !!option?.isPolicyExpenseChat ||
        !!option?.isTaskReport ||
        !!option?.isThread ||
        !!option?.isMoneyRequestReport ||
        !!option?.isInvoiceReport ||
        !!option?.private_isArchived ||
        isGroupChat(report) ||
        isSystemChat(report);

    const shouldParseFullTitle = option?.parentReportAction?.actionName !== CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT && !isGroupChat(report);

    const contentContainerStyles = isInFocusMode ? [styles.flex1, styles.flexRow, styles.overflowHidden, StyleUtils.getCompactContentContainerStyles()] : [styles.flex1];

    return (
        <View style={contentContainerStyles}>
            <View style={[styles.flexRow, styles.alignItemsCenter, styles.mw100, styles.overflowHidden]}>
                <DisplayNames
                    accessibilityLabel={translate('accessibilityHints.chatUserDisplayNames')}
                    fullTitle={option?.text ?? ''}
                    shouldParseFullTitle={shouldParseFullTitle}
                    displayNamesWithTooltips={option?.displayNamesWithTooltips ?? []}
                    tooltipEnabled
                    numberOfLines={1}
                    textStyles={displayNameStyle}
                    shouldUseFullTitle={shouldUseFullTitle}
                    testID={testID}
                />
                <RowOnboardingBadge reportID={reportID} />
                <RowStatusEmoji reportID={reportID} />
            </View>
            <RowAlternateText
                reportID={reportID}
                text={option?.alternateText}
                style={style}
            />
        </View>
    );
}

RowContent.displayName = 'RowContent';

export default RowContent;
