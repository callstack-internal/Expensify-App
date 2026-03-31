import React from 'react';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import EmojiPickerButton from '@components/EmojiPicker/EmojiPickerButton';
import ImportedStateIndicator from '@components/ImportedStateIndicator';
import useIsScrollLikelyLayoutTriggered from '@hooks/useIsScrollLikelyLayoutTriggered';
import useOnyx from '@hooks/useOnyx';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import {canUseTouchScreen} from '@libs/DeviceCapabilities';
import DomUtils from '@libs/DomUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import type * as OnyxCommon from '@src/types/onyx/OnyxCommon';
import ActionMenu from './ActionMenu';
import ComposerBox from './ComposerBox';
import type {SuggestionsRef} from './ComposerContext';
import {useComposerActions, useComposerInternalsActions, useComposerInternalsData, useComposerSendState} from './ComposerContext';
import ComposerDropZone from './ComposerDropZone';
import ComposerFooter from './ComposerFooter';
import ComposerLocalTime from './ComposerLocalTime';
import ComposerProvider from './ComposerProvider';
import ComposerInput from './ComposerWithSuggestions';
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
};

function ComposerBoxContent({reportID, lastReportAction}: ComposerBoxContentProps) {
    const styles = useThemeStyles();
    // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
    const {isMediumScreenWidth} = useResponsiveLayout();
    const {isBlockedFromConcierge, isSendDisabled} = useComposerSendState();
    const {handleSendMessage} = useComposerActions();
    const {composerRef} = useComposerInternalsData();
    const {setComposerRef} = useComposerInternalsActions();

    const {isScrollLayoutTriggered, raiseIsScrollLayoutTriggered} = useIsScrollLikelyLayoutTriggered();

    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);

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
            <ActionMenu
                reportID={reportID}
                raiseIsScrollLikelyLayoutTriggered={raiseIsScrollLayoutTriggered}
            />
            <ComposerInput
                ref={setComposerRef}
                reportID={reportID}
                lastReportAction={lastReportAction}
                isScrollLikelyLayoutTriggered={isScrollLayoutTriggered}
                raiseIsScrollLikelyLayoutTriggered={raiseIsScrollLayoutTriggered}
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
