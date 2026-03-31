import type {RefObject} from 'react';
import {useContext, useRef} from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import {scheduleOnUI} from 'react-native-worklets';
import useAncestors from '@hooks/useAncestors';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useIsInSidePanel from '@hooks/useIsInSidePanel';
import useOnyx from '@hooks/useOnyx';
import ComposerFocusManager from '@libs/ComposerFocusManager';
import {rand64} from '@libs/NumberUtils';
import {startSpan} from '@libs/telemetry/activeSpans';
import {useAgentZeroStatusActions} from '@pages/inbox/AgentZeroStatusContext';
import {ActionListContext} from '@pages/inbox/ReportScreenContext';
import {addAttachmentWithComment} from '@userActions/Report';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import type {FileObject} from '@src/types/utils/Attachment';
import type {ComposerRef} from './ComposerWithSuggestions/ComposerWithSuggestions';

type UseComposerSubmitParams = {
    report: OnyxEntry<OnyxTypes.Report>;
    reportID: string;
    onSubmit: (newComment: string, reportActionID?: string) => void;
    transactionThreadReportID?: string;
    composerRefShared: {get: () => Partial<ComposerRef>};
    updateShouldShowSuggestionMenuToFalse: () => void;
    setIsAttachmentPreviewActive: (value: boolean) => void;
};

type UseComposerSubmitReturn = {
    submitForm: (newComment: string) => void;
    addAttachment: (file: FileObject | FileObject[]) => void;
    onAttachmentPreviewClose: () => void;
    pendingDropObjectUrlsRef: RefObject<string[]>;
};

function useComposerSubmit({
    report,
    reportID,
    onSubmit,
    transactionThreadReportID,
    composerRefShared,
    updateShouldShowSuggestionMenuToFalse,
    setIsAttachmentPreviewActive,
}: UseComposerSubmitParams): UseComposerSubmitReturn {
    const isInSidePanel = useIsInSidePanel();
    const {kickoffWaitingIndicator} = useAgentZeroStatusActions();
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const {scrollOffsetRef} = useContext(ActionListContext);

    const [transactionThreadReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${transactionThreadReportID}`);
    const ancestors = useAncestors(transactionThreadReport ?? report);

    const attachmentFileRef = useRef<FileObject | FileObject[] | null>(null);
    const pendingDropObjectUrlsRef = useRef<string[]>([]);

    const addAttachment = (file: FileObject | FileObject[]) => {
        attachmentFileRef.current = file;
        pendingDropObjectUrlsRef.current = [];

        const clearWorklet = composerRefShared.get().clearWorklet;

        if (!clearWorklet) {
            throw new Error('The composerRef.clearWorklet function is not set yet. This should never happen, and indicates a developer error.');
        }

        scheduleOnUI(clearWorklet);
    };

    const onAttachmentPreviewClose = () => {
        if (attachmentFileRef.current === null) {
            for (const url of pendingDropObjectUrlsRef.current) {
                URL.revokeObjectURL(url);
            }
            pendingDropObjectUrlsRef.current = [];
        }
        updateShouldShowSuggestionMenuToFalse();
        setIsAttachmentPreviewActive(false);
        ComposerFocusManager.setReadyToFocus();
    };

    const submitForm = (newComment: string) => {
        const newCommentTrimmed = newComment.trim();

        kickoffWaitingIndicator();

        if (attachmentFileRef.current) {
            addAttachmentWithComment({
                report: transactionThreadReport ?? report,
                notifyReportID: reportID,
                ancestors,
                attachments: attachmentFileRef.current,
                currentUserAccountID: currentUserPersonalDetails.accountID,
                text: newCommentTrimmed,
                timezone: currentUserPersonalDetails.timezone,
                shouldPlaySound: true,
                isInSidePanel,
            });
            attachmentFileRef.current = null;
        } else {
            const optimisticReportActionID = rand64();

            const isScrolledToBottom = scrollOffsetRef.current < CONST.REPORT.ACTIONS.ACTION_VISIBLE_THRESHOLD;
            if (isScrolledToBottom) {
                startSpan(`${CONST.TELEMETRY.SPAN_SEND_MESSAGE}_${optimisticReportActionID}`, {
                    name: 'send-message',
                    op: CONST.TELEMETRY.SPAN_SEND_MESSAGE,
                    attributes: {
                        [CONST.TELEMETRY.ATTRIBUTE_REPORT_ID]: reportID,
                        [CONST.TELEMETRY.ATTRIBUTE_MESSAGE_LENGTH]: newCommentTrimmed.length,
                    },
                });
            }
            onSubmit(newCommentTrimmed, optimisticReportActionID);
        }
    };

    return {submitForm, addAttachment, onAttachmentPreviewClose, pendingDropObjectUrlsRef};
}

export default useComposerSubmit;
export type {UseComposerSubmitParams, UseComposerSubmitReturn};
