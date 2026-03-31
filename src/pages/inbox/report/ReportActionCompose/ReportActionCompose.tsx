import React, {useState} from 'react';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import EmojiPickerButton from '@components/EmojiPicker/EmojiPickerButton';
import ImportedStateIndicator from '@components/ImportedStateIndicator';
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
import {isEmojiPickerVisible} from '@userActions/EmojiPickerAction';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import type * as OnyxCommon from '@src/types/onyx/OnyxCommon';
import AttachmentPickerWithMenuItems from './AttachmentPickerWithMenuItems';
import ComposerBox, {useMeasureComposerBox} from './ComposerBox';
import type {SuggestionsRef} from './ComposerContext';
import {useComposerActions, useComposerInternalsActions, useComposerInternalsData, useComposerSendState, useComposerState} from './ComposerContext';
import ComposerDropZone from './ComposerDropZone';
import ComposerFooter from './ComposerFooter';
import ComposerLocalTime from './ComposerLocalTime';
import ComposerProvider from './ComposerProvider';
import ComposerWithSuggestions from './ComposerWithSuggestions';
import type {ComposerRef} from './ComposerWithSuggestions/ComposerWithSuggestions';
import SendButton from './SendButton';

type ReportActionComposeProps = {
    reportID: string;
    lastReportAction?: OnyxEntry<OnyxTypes.ReportAction>;
    pendingAction?: OnyxCommon.PendingAction;
    reportTransactions?: OnyxEntry<OnyxTypes.Transaction[]>;
    transactionThreadReportID?: string;
};

type ComposerBoxContentProps = {
    reportID: string;
    lastReportAction?: OnyxEntry<OnyxTypes.ReportAction>;
    isComposerFullSize: boolean;
};

function ComposerBoxContent({reportID, lastReportAction, isComposerFullSize}: ComposerBoxContentProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
    const {isMediumScreenWidth} = useResponsiveLayout();
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const {isFullComposerAvailable} = useComposerState();
    const {isBlockedFromConcierge, exceededMaxLength, isSendDisabled} = useComposerSendState();
    const {handleSendMessage, setIsFullComposerAvailable, onValueChange} = useComposerActions();
    const {userBlockedFromConcierge, shouldFocusComposerOnScreenFocus, composerRef, actionButtonRef, suggestionsRef, isNextModalWillOpenRef, shouldShowComposeInput} =
        useComposerInternalsData();
    const {setComposerRef, submitForm, onFocus, onBlur, onTriggerAttachmentPicker, onAddActionPressed, onItemSelected, validateAttachments} = useComposerInternalsActions();
    const measureContainer = useMeasureComposerBox();

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

    return (
        <>
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
        </>
    );
}

function Composer({reportID, lastReportAction, pendingAction, reportTransactions, transactionThreadReportID}: ReportActionComposeProps) {
    const styles = useThemeStyles();
    // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
    const {isSmallScreenWidth} = useResponsiveLayout();
    const [isComposerFullSize = false] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_IS_COMPOSER_FULL_SIZE}${reportID}`);

    return (
        <View style={[isComposerFullSize && styles.chatItemFullComposeRow]}>
            <ComposerProvider
                reportID={reportID}
                transactionThreadReportID={transactionThreadReportID}
            >
                <Composer.LocalTime
                    reportID={reportID}
                    pendingAction={pendingAction}
                />
                <View style={isComposerFullSize ? styles.flex1 : {}}>
                    <Composer.DropZone
                        reportID={reportID}
                        reportTransactions={reportTransactions}
                    >
                        <Composer.Box
                            reportID={reportID}
                            isComposerFullSize={isComposerFullSize}
                            pendingAction={pendingAction}
                        >
                            <ComposerBoxContent
                                reportID={reportID}
                                lastReportAction={lastReportAction}
                                isComposerFullSize={isComposerFullSize}
                            />
                        </Composer.Box>
                    </Composer.DropZone>
                    <Composer.Footer reportID={reportID} />
                    {!isSmallScreenWidth && (
                        <View style={[styles.mln5, styles.mrn5]}>
                            <ImportedStateIndicator />
                        </View>
                    )}
                </View>
            </ComposerProvider>
        </View>
    );
}

Composer.LocalTime = ComposerLocalTime;
Composer.Box = ComposerBox;
Composer.DropZone = ComposerDropZone;
Composer.Footer = ComposerFooter;

export default Composer;
export type {SuggestionsRef, ComposerRef, ReportActionComposeProps};
