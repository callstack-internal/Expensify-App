import React from 'react';
import type {StyleProp, TextStyle} from 'react-native';
import {View} from 'react-native';
import DisplayNames from '@components/DisplayNames';
import Text from '@components/Text';
import Tooltip from '@components/Tooltip';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';
import DateUtils from '@libs/DateUtils';
import {containsCustomEmoji as containsCustomEmojiUtils, containsOnlyCustomEmoji} from '@libs/EmojiUtils';
import FS from '@libs/Fullstory';
import {isChatUsedForOnboarding as isChatUsedForOnboardingReportUtils, isGroupChat, isOneOnOneChat, isSystemChat} from '@libs/ReportUtils';
import TextWithEmojiFragment from '@pages/inbox/report/comment/TextWithEmojiFragment';
import FreeTrial from '@pages/settings/Subscription/FreeTrial';
import CONST from '@src/CONST';
import type {OptionData} from '@src/libs/ReportUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import {isEmptyObject} from '@src/types/utils/EmptyObject';

type RowContentProps = {
    optionItem: OptionData;
    reportID: string;
    displayNameStyle: StyleProp<TextStyle>;
    alternateTextStyle: StyleProp<TextStyle>;
    isInFocusMode: boolean;
    testID: number;
};

function RowContent({optionItem, reportID, displayNameStyle, alternateTextStyle, isInFocusMode, testID}: RowContentProps) {
    const styles = useThemeStyles();
    const StyleUtils = useStyleUtils();
    const {translate} = useLocalize();
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const [conciergeReportID] = useOnyx(ONYXKEYS.CONCIERGE_REPORT_ID);
    const [introSelected] = useOnyx(ONYXKEYS.NVP_INTRO_SELECTED);
    const [onboarding] = useOnyx(ONYXKEYS.NVP_ONBOARDING);
    const onboardingPurpose = introSelected?.choice;

    const isChatUsedForOnboarding = isChatUsedForOnboardingReportUtils(report, onboarding, conciergeReportID, onboardingPurpose);

    const shouldUseFullTitle =
        !!optionItem.isChatRoom ||
        !!optionItem.isPolicyExpenseChat ||
        !!optionItem.isTaskReport ||
        !!optionItem.isThread ||
        !!optionItem.isMoneyRequestReport ||
        !!optionItem.isInvoiceReport ||
        !!optionItem.private_isArchived ||
        isGroupChat(report) ||
        isSystemChat(report);

    const shouldParseFullTitle = optionItem?.parentReportAction?.actionName !== CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT && !isGroupChat(report);

    const emojiCode = optionItem.status?.emojiCode ?? '';
    const statusText = optionItem.status?.text ?? '';
    const statusClearAfterDate = optionItem.status?.clearAfter ?? '';
    const currentSelectedTimezone = currentUserPersonalDetails?.timezone?.selected ?? CONST.DEFAULT_TIME_ZONE.selected;
    const formattedDate = DateUtils.getStatusUntilDate(translate, statusClearAfterDate, optionItem?.timezone?.selected ?? CONST.DEFAULT_TIME_ZONE.selected, currentSelectedTimezone);
    const statusContent = formattedDate ? `${statusText ? `${statusText} ` : ''}(${formattedDate})` : statusText;
    const isStatusVisible = !!emojiCode && isOneOnOneChat(!isEmptyObject(report) ? report : undefined);

    const alternateTextContainsCustomEmojiWithText = containsCustomEmojiUtils(optionItem?.alternateText) && !containsOnlyCustomEmoji(optionItem?.alternateText);
    const alternateTextFSClass = FS.getChatFSClass(report);

    const contentContainerStyles = isInFocusMode ? [styles.flex1, styles.flexRow, styles.overflowHidden, StyleUtils.getCompactContentContainerStyles()] : [styles.flex1];

    return (
        <View style={contentContainerStyles}>
            <View style={[styles.flexRow, styles.alignItemsCenter, styles.mw100, styles.overflowHidden]}>
                <DisplayNames
                    accessibilityLabel={translate('accessibilityHints.chatUserDisplayNames')}
                    fullTitle={optionItem.text ?? ''}
                    shouldParseFullTitle={shouldParseFullTitle}
                    displayNamesWithTooltips={optionItem.displayNamesWithTooltips ?? []}
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
            {!!optionItem.alternateText && (
                <Text
                    style={alternateTextStyle}
                    numberOfLines={1}
                    accessibilityLabel={translate('accessibilityHints.lastChatMessagePreview')}
                    fsClass={alternateTextFSClass}
                >
                    {alternateTextContainsCustomEmojiWithText ? (
                        <TextWithEmojiFragment
                            message={optionItem.alternateText}
                            style={[alternateTextStyle, styles.mh0]}
                            alignCustomEmoji
                        />
                    ) : (
                        optionItem.alternateText
                    )}
                </Text>
            )}
        </View>
    );
}

RowContent.displayName = 'RowContent';

export default RowContent;
