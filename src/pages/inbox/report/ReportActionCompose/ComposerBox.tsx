import React, {useEffect, useRef, useState} from 'react';
import type {MeasureInWindowOnSuccessCallback} from 'react-native';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import EmojiPickerButton from '@components/EmojiPicker/EmojiPickerButton';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useIsScrollLikelyLayoutTriggered from '@hooks/useIsScrollLikelyLayoutTriggered';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import {canUseTouchScreen} from '@libs/DeviceCapabilities';
import DomUtils from '@libs/DomUtils';
import FS from '@libs/Fullstory';
import {chatIncludesChronos, chatIncludesConcierge} from '@libs/ReportUtils';
import {hideEmojiPicker, isActive as isActiveEmojiPickerAction, isEmojiPickerVisible} from '@userActions/EmojiPickerAction';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import type * as OnyxCommon from '@src/types/onyx/OnyxCommon';
import AttachmentPickerWithMenuItems from './AttachmentPickerWithMenuItems';
import {useComposerActions, useComposerInternalsActions, useComposerInternalsData, useComposerSendState, useComposerState} from './ComposerContext';
import ComposerWithSuggestions from './ComposerWithSuggestions';
import SendButton from './SendButton';

type ComposerBoxProps = {
    reportID: string;
    lastReportAction?: OnyxEntry<OnyxTypes.ReportAction>;
    isComposerFullSize: boolean;
    pendingAction?: OnyxCommon.PendingAction;
};

function ComposerBox({reportID, lastReportAction, isComposerFullSize, pendingAction}: ComposerBoxProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
    const {isMediumScreenWidth} = useResponsiveLayout();
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const {isFocused, isFullComposerAvailable} = useComposerState();
    const {isBlockedFromConcierge, exceededMaxLength, isSendDisabled} = useComposerSendState();
    const {handleSendMessage, setIsFullComposerAvailable, onValueChange} = useComposerActions();
    const {
        userBlockedFromConcierge,
        shouldFocusComposerOnScreenFocus,
        composerRef,
        actionButtonRef,
        suggestionsRef,
        isNextModalWillOpenRef,
        shouldShowComposeInput,
        PDFValidationComponent,
        ErrorModal,
    } = useComposerInternalsData();
    const {setComposerRef, submitForm, onFocus, onBlur, onTriggerAttachmentPicker, onAddActionPressed, onItemSelected, validateAttachments} = useComposerInternalsActions();

    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);

    const {isScrollLayoutTriggered, raiseIsScrollLayoutTriggered} = useIsScrollLikelyLayoutTriggered();
    const [isMenuVisible, setMenuVisibility] = useState(false);

    const includesConcierge = chatIncludesConcierge({participants: report?.participants});
    const inputPlaceholder = includesConcierge && userBlockedFromConcierge ? translate('reportActionCompose.blockedFromConcierge') : translate('reportActionCompose.writeSomething');
    const isGroupPolicyReport = !!report?.policyID && report.policyID !== CONST.POLICY.ID_FAKE;
    const reportParticipantIDs = Object.keys(report?.participants ?? {})
        .map(Number)
        .filter((accountID) => accountID !== currentUserPersonalDetails.accountID);

    const fsClass = FS.getChatFSClass(report);

    const emojiPositionValues = {
        secondaryRowHeight: styles.chatItemComposeSecondaryRow.height,
        secondaryRowMarginTop: styles.chatItemComposeSecondaryRow.marginTop,
        secondaryRowMarginBottom: styles.chatItemComposeSecondaryRow.marginBottom,
        composeBoxMinHeight: styles.chatItemComposeBox.minHeight,
        emojiButtonHeight: styles.chatItemEmojiButton.height,
    };
    const chatItemComposeSecondaryRowHeight = emojiPositionValues.secondaryRowHeight + emojiPositionValues.secondaryRowMarginTop + emojiPositionValues.secondaryRowMarginBottom;
    const reportActionComposeHeight = emojiPositionValues.composeBoxMinHeight + chatItemComposeSecondaryRowHeight;
    const emojiOffsetWithComposeBox = (emojiPositionValues.composeBoxMinHeight - emojiPositionValues.emojiButtonHeight) / 2;
    const emojiShiftVertical = reportActionComposeHeight - emojiOffsetWithComposeBox - CONST.MENU_POSITION_REPORT_ACTION_COMPOSE_BOTTOM;

    useEffect(
        () => () => {
            if (!isActiveEmojiPickerAction(report?.reportID)) {
                return;
            }
            hideEmojiPicker();
        },
        [report?.reportID],
    );

    // --- Attachment/OfflineWithFeedback box ---
    const shouldUseFocusedColor = !isBlockedFromConcierge && isFocused;
    const containerRef = useRef<View>(null);
    const measureContainer = (callback: MeasureInWindowOnSuccessCallback) => {
        if (!containerRef.current) {
            return;
        }
        containerRef.current.measureInWindow(callback);
    };

    return (
        <OfflineWithFeedback
            shouldDisableOpacity
            pendingAction={pendingAction}
            style={isComposerFullSize ? styles.chatItemFullComposeRow : {}}
            contentContainerStyle={isComposerFullSize ? styles.flex1 : {}}
        >
            <View
                ref={containerRef}
                style={[
                    shouldUseFocusedColor ? styles.chatItemComposeBoxFocusedColor : styles.chatItemComposeBoxColor,
                    styles.flexRow,
                    styles.chatItemComposeBox,
                    isComposerFullSize && styles.chatItemFullComposeBox,
                    !!exceededMaxLength && styles.borderColorDanger,
                ]}
            >
                {PDFValidationComponent}
                <AttachmentPickerWithMenuItems
                    onAttachmentPicked={(files) => validateAttachments({files})}
                    reportID={reportID}
                    report={report}
                    currentUserPersonalDetails={currentUserPersonalDetails}
                    reportParticipantIDs={reportParticipantIDs}
                    isFullComposerAvailable={isFullComposerAvailable}
                    isComposerFullSize={isComposerFullSize}
                    disabled={isBlockedFromConcierge}
                    setMenuVisibility={setMenuVisibility}
                    isMenuVisible={isMenuVisible}
                    onTriggerAttachmentPicker={onTriggerAttachmentPicker}
                    raiseIsScrollLikelyLayoutTriggered={raiseIsScrollLayoutTriggered}
                    onAddActionPressed={onAddActionPressed}
                    onItemSelected={onItemSelected}
                    onCanceledAttachmentPicker={() => {
                        if (!shouldFocusComposerOnScreenFocus) {
                            return;
                        }
                        composerRef.current?.focus(true);
                    }}
                    actionButtonRef={actionButtonRef}
                    shouldDisableAttachmentItem={!!exceededMaxLength}
                />
                <ComposerWithSuggestions
                    ref={setComposerRef}
                    suggestionsRef={suggestionsRef}
                    isNextModalWillOpenRef={isNextModalWillOpenRef}
                    isScrollLikelyLayoutTriggered={isScrollLayoutTriggered}
                    raiseIsScrollLikelyLayoutTriggered={raiseIsScrollLayoutTriggered}
                    reportID={reportID}
                    policyID={report?.policyID}
                    includeChronos={chatIncludesChronos(report)}
                    isGroupPolicyReport={isGroupPolicyReport}
                    lastReportAction={lastReportAction}
                    isMenuVisible={isMenuVisible}
                    inputPlaceholder={inputPlaceholder}
                    isComposerFullSize={isComposerFullSize}
                    setIsFullComposerAvailable={setIsFullComposerAvailable}
                    onPasteFile={(files) => validateAttachments({files})}
                    onClear={submitForm}
                    disabled={isBlockedFromConcierge || isEmojiPickerVisible()}
                    onEnterKeyPress={handleSendMessage}
                    shouldShowComposeInput={shouldShowComposeInput}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    measureParentContainer={measureContainer}
                    onValueChange={onValueChange}
                    forwardedFSClass={fsClass}
                />
                {canUseTouchScreen() && isMediumScreenWidth ? null : (
                    <EmojiPickerButton
                        isDisabled={isBlockedFromConcierge}
                        onModalHide={(isNavigating) => {
                            if (isNavigating) {
                                return;
                            }
                            const activeElementId = DomUtils.getActiveElement()?.id;
                            if (activeElementId === CONST.COMPOSER.NATIVE_ID || activeElementId === CONST.EMOJI_PICKER_BUTTON_NATIVE_ID) {
                                return;
                            }
                            composerRef.current?.focus(true);
                        }}
                        onEmojiSelected={(...args) => composerRef.current?.replaceSelectionWithText(...args)}
                        emojiPickerID={report?.reportID}
                        shiftVertical={emojiShiftVertical}
                    />
                )}
                <SendButton
                    isDisabled={isSendDisabled}
                    handleSendMessage={handleSendMessage}
                />
            </View>
            {ErrorModal}
        </OfflineWithFeedback>
    );
}

export default ComposerBox;
