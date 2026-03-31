import React, {useEffect, useState} from 'react';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import EmojiPickerButton from '@components/EmojiPicker/EmojiPickerButton';
import ImportedStateIndicator from '@components/ImportedStateIndicator';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useIsScrollLikelyLayoutTriggered from '@hooks/useIsScrollLikelyLayoutTriggered';
import useLocalize from '@hooks/useLocalize';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import {canUseTouchScreen} from '@libs/DeviceCapabilities';
import DomUtils from '@libs/DomUtils';
import FS from '@libs/Fullstory';
import {chatIncludesChronos, chatIncludesConcierge} from '@libs/ReportUtils';
import {hideEmojiPicker, isActive as isActiveEmojiPickerAction, isEmojiPickerVisible} from '@userActions/EmojiPickerAction';
import CONST from '@src/CONST';
import type * as OnyxTypes from '@src/types/onyx';
import type * as OnyxCommon from '@src/types/onyx/OnyxCommon';
import AttachmentPickerWithMenuItems from './AttachmentPickerWithMenuItems';
import ComposerBox from './ComposerBox';
import type {SuggestionsRef} from './ComposerContext';
import {useComposerActions, useComposerInternalsActions, useComposerInternalsData, useComposerSendState, useComposerState} from './ComposerContext';
import ComposerDropZone from './ComposerDropZone';
import ComposerFooter from './ComposerFooter';
import ComposerLocalTime from './ComposerLocalTime';
import ComposerProvider from './ComposerProvider';
import ComposerWithSuggestions from './ComposerWithSuggestions';
import type {ComposerRef, ComposerWithSuggestionsProps} from './ComposerWithSuggestions/ComposerWithSuggestions';
import SendButton from './SendButton';

type ReportActionComposeProps = Pick<ComposerWithSuggestionsProps, 'reportID' | 'isComposerFullSize' | 'lastReportAction'> & {
    onSubmit: (newComment: string, reportActionID?: string) => void;
    report: OnyxEntry<OnyxTypes.Report>;
    transactionThreadReportID?: string;
    reportTransactions?: OnyxEntry<OnyxTypes.Transaction[]>;
    pendingAction?: OnyxCommon.PendingAction;
    onComposerFocus?: () => void;
    onComposerBlur?: () => void;
    didHideComposerInput?: boolean;
};

function ReportActionCompose({
    isComposerFullSize = false,
    onSubmit,
    pendingAction,
    report,
    reportID,
    lastReportAction,
    onComposerFocus,
    onComposerBlur,
    didHideComposerInput,
    reportTransactions,
    transactionThreadReportID,
}: ReportActionComposeProps) {
    const styles = useThemeStyles();
    // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
    const {isSmallScreenWidth} = useResponsiveLayout();

    return (
        <View style={[isComposerFullSize && styles.chatItemFullComposeRow]}>
            <ComposerProvider
                reportID={reportID}
                report={report}
                isComposerFullSize={isComposerFullSize}
                onSubmit={onSubmit}
                transactionThreadReportID={transactionThreadReportID}
                onComposerFocus={onComposerFocus}
                onComposerBlur={onComposerBlur}
            >
                <ComposerLocalTime
                    reportID={reportID}
                    pendingAction={pendingAction}
                />
                <View style={isComposerFullSize ? styles.flex1 : {}}>
                    <ComposerBoxContent
                        reportID={reportID}
                        report={report}
                        lastReportAction={lastReportAction}
                        isComposerFullSize={isComposerFullSize}
                        didHideComposerInput={didHideComposerInput}
                        reportTransactions={reportTransactions}
                        pendingAction={pendingAction}
                    />
                    <ComposerFooter reportID={reportID} />
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

type ComposerBoxContentProps = {
    reportID: string;
    report: OnyxEntry<OnyxTypes.Report>;
    lastReportAction?: OnyxEntry<OnyxTypes.ReportAction>;
    isComposerFullSize: boolean;
    didHideComposerInput?: boolean;
    reportTransactions?: OnyxEntry<OnyxTypes.Transaction[]>;
    pendingAction?: OnyxCommon.PendingAction;
};

function ComposerBoxContent({reportID, report, lastReportAction, isComposerFullSize, didHideComposerInput, reportTransactions, pendingAction}: ComposerBoxContentProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
    const {isMediumScreenWidth} = useResponsiveLayout();
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const {isFullComposerAvailable} = useComposerState();
    const {isBlockedFromConcierge, exceededMaxLength, isSendDisabled} = useComposerSendState();
    const {handleSendMessage, setIsFullComposerAvailable, setIsCommentEmpty, onValueChange} = useComposerActions();
    const internalsData = useComposerInternalsData();
    const internalsActions = useComposerInternalsActions();

    const {isScrollLayoutTriggered, raiseIsScrollLayoutTriggered} = useIsScrollLikelyLayoutTriggered();
    const [isMenuVisible, setMenuVisibility] = useState(false);

    const includesConcierge = chatIncludesConcierge({participants: report?.participants});
    const inputPlaceholder =
        includesConcierge && internalsData.userBlockedFromConcierge ? translate('reportActionCompose.blockedFromConcierge') : translate('reportActionCompose.writeSomething');
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

    return (
        <ComposerBox
            reportID={reportID}
            report={report}
            pendingAction={pendingAction}
            addAttachment={internalsActions.addAttachment}
            onAttachmentPreviewClose={internalsActions.onAttachmentPreviewClose}
            pendingDropObjectUrlsRef={internalsData.pendingDropObjectUrlsRef}
            isAttachmentPreviewActive={internalsData.isAttachmentPreviewActive}
            setIsAttachmentPreviewActive={internalsActions.setIsAttachmentPreviewActive}
        >
            {(boxProps) => (
                <>
                    <AttachmentPickerWithMenuItems
                        onAttachmentPicked={(files) => boxProps.validateAttachments({files})}
                        reportID={reportID}
                        report={report}
                        currentUserPersonalDetails={currentUserPersonalDetails}
                        reportParticipantIDs={reportParticipantIDs}
                        isFullComposerAvailable={isFullComposerAvailable}
                        isComposerFullSize={isComposerFullSize}
                        disabled={isBlockedFromConcierge}
                        setMenuVisibility={setMenuVisibility}
                        isMenuVisible={isMenuVisible}
                        onTriggerAttachmentPicker={internalsActions.onTriggerAttachmentPicker}
                        raiseIsScrollLikelyLayoutTriggered={raiseIsScrollLayoutTriggered}
                        onAddActionPressed={internalsActions.onAddActionPressed}
                        onItemSelected={internalsActions.onItemSelected}
                        onCanceledAttachmentPicker={() => {
                            if (!internalsData.shouldFocusComposerOnScreenFocus) {
                                return;
                            }
                            internalsData.composerRef.current?.focus(true);
                        }}
                        actionButtonRef={internalsData.actionButtonRef}
                        shouldDisableAttachmentItem={!!exceededMaxLength}
                    />
                    <ComposerWithSuggestions
                        ref={internalsActions.setComposerRef}
                        suggestionsRef={internalsData.suggestionsRef}
                        isNextModalWillOpenRef={internalsData.isNextModalWillOpenRef}
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
                        onPasteFile={(files) => boxProps.validateAttachments({files})}
                        onClear={internalsActions.submitForm}
                        disabled={isBlockedFromConcierge || isEmojiPickerVisible()}
                        setIsCommentEmpty={setIsCommentEmpty}
                        onEnterKeyPress={handleSendMessage}
                        shouldShowComposeInput={internalsData.shouldShowComposeInput}
                        onFocus={internalsActions.onFocus}
                        onBlur={internalsActions.onBlur}
                        measureParentContainer={boxProps.measureContainer}
                        onValueChange={onValueChange}
                        didHideComposerInput={didHideComposerInput}
                        forwardedFSClass={fsClass}
                    />
                    <ComposerDropZone
                        report={report}
                        reportTransactions={reportTransactions}
                        onAttachmentDrop={boxProps.handleAttachmentDrop}
                        onReceiptDrop={boxProps.onReceiptDropped}
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
                                internalsData.composerRef.current?.focus(true);
                            }}
                            onEmojiSelected={(...args) => internalsData.composerRef.current?.replaceSelectionWithText(...args)}
                            emojiPickerID={report?.reportID}
                            shiftVertical={emojiShiftVertical}
                        />
                    )}
                    <SendButton
                        isDisabled={isSendDisabled}
                        handleSendMessage={handleSendMessage}
                    />
                </>
            )}
        </ComposerBox>
    );
}

export default ReportActionCompose;
export type {SuggestionsRef, ComposerRef, ReportActionComposeProps};
