import React, {useRef} from 'react';
import type {MeasureInWindowOnSuccessCallback} from 'react-native';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import useThemeStyles from '@hooks/useThemeStyles';
import type * as OnyxTypes from '@src/types/onyx';
import type * as OnyxCommon from '@src/types/onyx/OnyxCommon';
import type {FileObject} from '@src/types/utils/Attachment';
import {useComposerSendState, useComposerState} from './ComposerContext';
import useAttachmentUploadValidation from './useAttachmentUploadValidation';

type ComposerBoxProps = {
    reportID: string;
    report: OnyxEntry<OnyxTypes.Report>;
    pendingAction?: OnyxCommon.PendingAction;
    children: (boxRenderProps: ComposerBoxRenderProps) => React.ReactNode;
    addAttachment: (file: FileObject | FileObject[]) => void;
    onAttachmentPreviewClose: () => void;
    pendingDropObjectUrlsRef: React.RefObject<string[]>;
    isAttachmentPreviewActive: boolean;
    setIsAttachmentPreviewActive: (isActive: boolean) => void;
};

type ComposerBoxRenderProps = {
    containerRef: React.RefObject<View | null>;
    measureContainer: (callback: MeasureInWindowOnSuccessCallback) => void;
    validateAttachments: ReturnType<typeof useAttachmentUploadValidation>['validateAttachments'];
    handleAttachmentDrop: (event: DragEvent) => void;
    onReceiptDropped: ReturnType<typeof useAttachmentUploadValidation>['onReceiptDropped'];
};

function ComposerBox({
    reportID,
    report,
    pendingAction,
    addAttachment,
    onAttachmentPreviewClose,
    pendingDropObjectUrlsRef,
    isAttachmentPreviewActive,
    setIsAttachmentPreviewActive,
    children,
}: ComposerBoxProps) {
    const styles = useThemeStyles();
    const {isFocused, isComposerFullSize} = useComposerState();
    const {exceededMaxLength, isBlockedFromConcierge} = useComposerSendState();

    const shouldUseFocusedColor = !isBlockedFromConcierge && isFocused;

    const containerRef = useRef<View>(null);
    const measureContainer = (callback: MeasureInWindowOnSuccessCallback) => {
        if (!containerRef.current) {
            return;
        }
        containerRef.current.measureInWindow(callback);
    };

    const {validateAttachments, onReceiptDropped, PDFValidationComponent, ErrorModal} = useAttachmentUploadValidation({
        reportID,
        addAttachment,
        onAttachmentPreviewClose,
        exceededMaxLength,
        report,
        isAttachmentPreviewActive,
        setIsAttachmentPreviewActive,
    });

    const handleAttachmentDrop = (event: DragEvent) => {
        const createdUrls: string[] = [];
        const files = Array.from(event.dataTransfer?.files ?? []).map((file) => {
            const fileWithUri = file;
            const objectUrl = URL.createObjectURL(fileWithUri);
            fileWithUri.uri = objectUrl;
            createdUrls.push(objectUrl);
            return fileWithUri;
        });

        if (files.length === 0) {
            return;
        }

        // eslint-disable-next-line no-param-reassign -- Ref forwarded from provider; assigning .current is the intended API
        pendingDropObjectUrlsRef.current = createdUrls;
        validateAttachments({files});
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
                {children({
                    containerRef,
                    measureContainer,
                    validateAttachments,
                    handleAttachmentDrop,
                    onReceiptDropped,
                })}
            </View>
            {ErrorModal}
        </OfflineWithFeedback>
    );
}

export default ComposerBox;
export type {ComposerBoxProps, ComposerBoxRenderProps};
