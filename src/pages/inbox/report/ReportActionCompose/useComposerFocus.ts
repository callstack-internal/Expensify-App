import type {RefObject} from 'react';
import {useRef} from 'react';
import type {BlurEvent, View} from 'react-native';
import willBlurTextInputOnTapOutsideFunc from '@libs/willBlurTextInputOnTapOutside';
import type {ComposerRef} from './ComposerWithSuggestions/ComposerWithSuggestions';
import type {SuggestionsRef} from './ReportActionCompose';

const willBlurTextInputOnTapOutside = willBlurTextInputOnTapOutsideFunc();

type UseComposerFocusParams = {
    composerRef: RefObject<ComposerRef | null>;
    suggestionsRef: RefObject<SuggestionsRef | null>;
    actionButtonRef: RefObject<View | HTMLDivElement | null>;
    setIsFocused: (value: boolean) => void;
    onComposerFocus?: () => void;
    onComposerBlur?: () => void;
};

type UseComposerFocusReturn = {
    onBlur: (event: BlurEvent) => void;
    onFocus: () => void;
    focus: () => void;
    onAddActionPressed: () => void;
    onItemSelected: () => void;
    onTriggerAttachmentPicker: () => void;
    isNextModalWillOpenRef: RefObject<boolean>;
    isKeyboardVisibleWhenShowingModalRef: RefObject<boolean>;
};

function useComposerFocus({composerRef, suggestionsRef, actionButtonRef, setIsFocused, onComposerFocus, onComposerBlur}: UseComposerFocusParams): UseComposerFocusReturn {
    const isKeyboardVisibleWhenShowingModalRef = useRef(false);
    const isNextModalWillOpenRef = useRef(false);

    const focus = () => {
        if (composerRef.current === null) {
            return;
        }
        composerRef.current?.focus(true);
    };

    const onAddActionPressed = () => {
        if (!willBlurTextInputOnTapOutside) {
            isKeyboardVisibleWhenShowingModalRef.current = !!composerRef.current?.isFocused();
        }
        composerRef.current?.blur();
    };

    const onItemSelected = () => {
        isKeyboardVisibleWhenShowingModalRef.current = false;
    };

    const onTriggerAttachmentPicker = () => {
        isNextModalWillOpenRef.current = true;
        isKeyboardVisibleWhenShowingModalRef.current = true;
    };

    const onBlur = (event: BlurEvent) => {
        const webEvent = event as unknown as FocusEvent;
        setIsFocused(false);
        onComposerBlur?.();
        if (suggestionsRef.current) {
            suggestionsRef.current.resetSuggestions();
        }
        if (webEvent.relatedTarget && webEvent.relatedTarget === actionButtonRef.current) {
            isKeyboardVisibleWhenShowingModalRef.current = true;
        }
    };

    const onFocus = () => {
        setIsFocused(true);
        onComposerFocus?.();
    };

    return {onBlur, onFocus, focus, onAddActionPressed, onItemSelected, onTriggerAttachmentPicker, isNextModalWillOpenRef, isKeyboardVisibleWhenShowingModalRef};
}

export default useComposerFocus;
export type {UseComposerFocusParams, UseComposerFocusReturn};
