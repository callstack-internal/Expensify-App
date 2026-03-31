import lodashDebounce from 'lodash/debounce';
import React, {useRef, useState} from 'react';
import type {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import {useSharedValue} from 'react-native-reanimated';
import {scheduleOnUI} from 'react-native-worklets';
import useHandleExceedMaxCommentLength from '@hooks/useHandleExceedMaxCommentLength';
import useHandleExceedMaxTaskTitleLength from '@hooks/useHandleExceedMaxTaskTitleLength';
import useOnyx from '@hooks/useOnyx';
import canFocusInputOnScreenFocus from '@libs/canFocusInputOnScreenFocus';
import {chatIncludesConcierge} from '@libs/ReportUtils';
import {setIsComposerFullSize} from '@userActions/Report';
import {isBlockedFromConcierge as isBlockedFromConciergeUserAction} from '@userActions/User';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import {ComposerActionsContext, ComposerInternalsActionsContext, ComposerInternalsDataContext, ComposerSendStateContext, ComposerStateContext} from './ComposerContext';
import type {SuggestionsRef} from './ComposerContext';
import type {ComposerRef} from './ComposerWithSuggestions/ComposerWithSuggestions';
import useComposerFocus from './useComposerFocus';
import useComposerSubmit from './useComposerSubmit';

const shouldFocusInputOnScreenFocus = canFocusInputOnScreenFocus();

type ComposerProviderProps = {
    reportID: string;
    report: OnyxEntry<OnyxTypes.Report>;
    isComposerFullSize: boolean;
    onSubmit: (newComment: string, reportActionID?: string) => void;
    transactionThreadReportID?: string;
    onComposerFocus?: () => void;
    onComposerBlur?: () => void;
    children: React.ReactNode;
};

function ComposerProvider({children, reportID, report, isComposerFullSize, onSubmit, transactionThreadReportID, onComposerFocus, onComposerBlur}: ComposerProviderProps) {
    const [blockedFromConcierge] = useOnyx(ONYXKEYS.NVP_BLOCKED_FROM_CONCIERGE);
    const [shouldShowComposeInput = true] = useOnyx(ONYXKEYS.SHOULD_SHOW_COMPOSE_INPUT);
    const [initialModalState] = useOnyx(ONYXKEYS.MODAL);
    const [draftComment] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_DRAFT_COMMENT}${reportID}`);

    const shouldFocusComposerOnScreenFocus = shouldFocusInputOnScreenFocus || !!draftComment;

    const [isFocused, setIsFocused] = useState(() => {
        return shouldFocusComposerOnScreenFocus && shouldShowComposeInput && !initialModalState?.isVisible && !initialModalState?.willAlertModalBecomeVisible;
    });

    const [isFullComposerAvailable, setIsFullComposerAvailable] = useState(isComposerFullSize);

    const [isCommentEmpty, setIsCommentEmpty] = useState(() => {
        return !draftComment || !!draftComment.match(CONST.REGEX.EMPTY_COMMENT);
    });

    const includesConcierge = chatIncludesConcierge({participants: report?.participants});
    const userBlockedFromConcierge = isBlockedFromConciergeUserAction(blockedFromConcierge);
    const isBlockedFromConcierge = includesConcierge && userBlockedFromConcierge;

    const {hasExceededMaxCommentLength, validateCommentMaxLength, setHasExceededMaxCommentLength} = useHandleExceedMaxCommentLength();
    const {hasExceededMaxTaskTitleLength, validateTaskTitleMaxLength, setHasExceededMaxTitleLength} = useHandleExceedMaxTaskTitleLength();

    const exceededMaxLength = (() => {
        if (hasExceededMaxTaskTitleLength) {
            return CONST.TITLE_CHARACTER_LIMIT;
        }
        if (hasExceededMaxCommentLength) {
            return CONST.MAX_COMMENT_LENGTH;
        }
        return null;
    })();

    const isSendDisabled = isCommentEmpty || isBlockedFromConcierge || !!exceededMaxLength;

    const validateMaxLength = (value: string) => {
        const taskCommentMatch = value?.match(CONST.REGEX.TASK_TITLE_WITH_OPTIONAL_SHORT_MENTION);
        if (taskCommentMatch) {
            const title = taskCommentMatch?.[3] ? taskCommentMatch[3].trim().replaceAll('\n', ' ') : '';
            setHasExceededMaxCommentLength(false);
            return validateTaskTitleMaxLength(title);
        }
        setHasExceededMaxTitleLength(false);
        return validateCommentMaxLength(value, {reportID});
    };

    const debouncedValidate = lodashDebounce(validateMaxLength, CONST.TIMING.COMMENT_LENGTH_DEBOUNCE_TIME, {leading: true});

    const suggestionsRef = useRef<SuggestionsRef>(null);
    const composerRef = useRef<ComposerRef | null>(null);
    const actionButtonRef = useRef<View | HTMLDivElement | null>(null);

    const composerRefShared = useSharedValue<Partial<ComposerRef>>({});

    const updateShouldShowSuggestionMenuToFalse = () => {
        if (!suggestionsRef.current) {
            return;
        }
        suggestionsRef.current.updateShouldShowSuggestionMenuToFalse(false);
    };

    const {onBlur, onFocus, focus, onAddActionPressed, onItemSelected, onTriggerAttachmentPicker, isNextModalWillOpenRef} = useComposerFocus({
        composerRef,
        suggestionsRef,
        actionButtonRef,
        setIsFocused,
        onComposerFocus,
        onComposerBlur,
    });

    const [isAttachmentPreviewActive, setIsAttachmentPreviewActive] = useState(false);

    const {submitForm, addAttachment, onAttachmentPreviewClose, pendingDropObjectUrlsRef} = useComposerSubmit({
        report,
        reportID,
        onSubmit,
        transactionThreadReportID,
        composerRefShared,
        updateShouldShowSuggestionMenuToFalse,
        setIsAttachmentPreviewActive,
    });

    const handleSendMessage = () => {
        if (isSendDisabled || !debouncedValidate.flush()) {
            return;
        }

        composerRef.current?.resetHeight();
        if (isComposerFullSize) {
            setIsComposerFullSize(reportID, false);
        }

        scheduleOnUI(() => {
            const {clearWorklet} = composerRefShared.get();

            if (!clearWorklet) {
                throw new Error('The composerRef.clearWorklet function is not set yet. This should never happen, and indicates a developer error.');
            }

            clearWorklet?.();
        });
    };

    const setComposerRef = (ref: ComposerRef | null) => {
        composerRef.current = ref;
        composerRefShared.set({
            clearWorklet: ref?.clearWorklet,
        });
    };

    const onValueChange = (value: string) => {
        if (value.length === 0 && isComposerFullSize) {
            setIsComposerFullSize(reportID, false);
        }
        debouncedValidate(value);
    };

    const composerState = {
        isFocused,
        isFullComposerAvailable,
        isComposerFullSize,
    };

    const composerSendState = {
        isEmpty: isCommentEmpty,
        exceededMaxLength,
        isSendDisabled,
        isBlockedFromConcierge,
        hasExceededMaxTaskTitleLength,
    };

    const composerActions = {
        setIsFocused,
        setIsFullComposerAvailable,
        setIsCommentEmpty,
        handleSendMessage,
        focus,
        onValueChange,
        validateMaxLength,
        debouncedValidate,
    };

    const composerInternalsData = {
        composerRef,
        suggestionsRef,
        actionButtonRef,
        isNextModalWillOpenRef,
        pendingDropObjectUrlsRef,
        shouldFocusComposerOnScreenFocus,
        shouldShowComposeInput,
        isAttachmentPreviewActive,
        userBlockedFromConcierge,
    };

    const composerInternalsActions = {
        setComposerRef,
        onBlur,
        onFocus,
        onAddActionPressed,
        onItemSelected,
        onTriggerAttachmentPicker,
        submitForm,
        addAttachment,
        onAttachmentPreviewClose,
        setIsAttachmentPreviewActive,
    };

    return (
        <ComposerStateContext.Provider value={composerState}>
            <ComposerSendStateContext.Provider value={composerSendState}>
                <ComposerActionsContext.Provider value={composerActions}>
                    <ComposerInternalsDataContext.Provider value={composerInternalsData}>
                        <ComposerInternalsActionsContext.Provider value={composerInternalsActions}>{children}</ComposerInternalsActionsContext.Provider>
                    </ComposerInternalsDataContext.Provider>
                </ComposerActionsContext.Provider>
            </ComposerSendStateContext.Provider>
        </ComposerStateContext.Provider>
    );
}

export default ComposerProvider;
export type {ComposerProviderProps};
