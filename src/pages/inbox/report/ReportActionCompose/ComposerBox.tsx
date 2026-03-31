import React, {createContext, useContext, useEffect, useRef} from 'react';
import type {MeasureInWindowOnSuccessCallback} from 'react-native';
import {View} from 'react-native';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import useOnyx from '@hooks/useOnyx';
import useThemeStyles from '@hooks/useThemeStyles';
import {hideEmojiPicker, isActive as isActiveEmojiPickerAction} from '@userActions/EmojiPickerAction';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxCommon from '@src/types/onyx/OnyxCommon';
import {useComposerInternalsData, useComposerSendState, useComposerState} from './ComposerContext';

type MeasureContainerFn = (callback: MeasureInWindowOnSuccessCallback) => void;

const ComposerBoxContext = createContext<MeasureContainerFn>(() => {});

function useMeasureComposerBox(): MeasureContainerFn {
    return useContext(ComposerBoxContext);
}

type ComposerBoxProps = {
    children: React.ReactNode;
    reportID: string;
    isComposerFullSize: boolean;
    pendingAction?: OnyxCommon.PendingAction;
};

function ComposerBox({children, reportID, isComposerFullSize, pendingAction}: ComposerBoxProps) {
    const styles = useThemeStyles();
    const {isFocused} = useComposerState();
    const {isBlockedFromConcierge, exceededMaxLength} = useComposerSendState();
    const {PDFValidationComponent, ErrorModal} = useComposerInternalsData();

    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);

    const shouldUseFocusedColor = !isBlockedFromConcierge && isFocused;

    const containerRef = useRef<View>(null);
    const measureContainer = (callback: MeasureInWindowOnSuccessCallback) => {
        if (!containerRef.current) {
            return;
        }
        containerRef.current.measureInWindow(callback);
    };

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
                <ComposerBoxContext.Provider value={measureContainer}>{children}</ComposerBoxContext.Provider>
            </View>
            {ErrorModal}
        </OfflineWithFeedback>
    );
}

export default ComposerBox;
export {useMeasureComposerBox};
export type {MeasureContainerFn};
