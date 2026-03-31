import {Str} from 'expensify-common';
import type {RefObject} from 'react';
import {useContext, useRef} from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import {scheduleOnUI} from 'react-native-worklets';
import {usePersonalDetails} from '@components/OnyxListItemProvider';
import useAncestors from '@hooks/useAncestors';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useIsInSidePanel from '@hooks/useIsInSidePanel';
import useOnyx from '@hooks/useOnyx';
import useShortMentionsList from '@hooks/useShortMentionsList';
import ComposerFocusManager from '@libs/ComposerFocusManager';
import {isEmailPublicDomain} from '@libs/LoginUtils';
import {rand64} from '@libs/NumberUtils';
import {addDomainToShortMention} from '@libs/ParsingUtils';
import {startSpan} from '@libs/telemetry/activeSpans';
import {generateAccountID} from '@libs/UserUtils';
import {useAgentZeroStatusActions} from '@pages/inbox/AgentZeroStatusContext';
import {ActionListContext} from '@pages/inbox/ReportScreenContext';
import {addAttachmentWithComment, addComment} from '@userActions/Report';
import {createTaskAndNavigate, setNewOptimisticAssignee} from '@userActions/Task';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import type {FileObject} from '@src/types/utils/Attachment';
import type {ComposerRef} from './ComposerWithSuggestions/ComposerWithSuggestions';

type UseComposerSubmitParams = {
    report: OnyxEntry<OnyxTypes.Report>;
    reportID: string;
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
    setPendingDropObjectUrls: (urls: string[]) => void;
};

function useComposerSubmit({
    report,
    reportID,
    transactionThreadReportID,
    composerRefShared,
    updateShouldShowSuggestionMenuToFalse,
    setIsAttachmentPreviewActive,
}: UseComposerSubmitParams): UseComposerSubmitReturn {
    const isInSidePanel = useIsInSidePanel();
    const {kickoffWaitingIndicator} = useAgentZeroStatusActions();
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const {scrollOffsetRef} = useContext(ActionListContext);
    const allPersonalDetails = usePersonalDetails();
    const {availableLoginsList} = useShortMentionsList();
    const [quickAction] = useOnyx(ONYXKEYS.NVP_QUICK_ACTION_GLOBAL_CREATE);

    const [transactionThreadReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${transactionThreadReportID}`);
    const targetReport = transactionThreadReport ?? report;
    const ancestors = useAncestors(targetReport);

    const attachmentFileRef = useRef<FileObject | FileObject[] | null>(null);
    const pendingDropObjectUrlsRef = useRef<string[]>([]);

    const addAttachmentHandler = (file: FileObject | FileObject[]) => {
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

    const handleCreateTask = (text: string): boolean => {
        const match = text.match(CONST.REGEX.TASK_TITLE_WITH_OPTIONAL_SHORT_MENTION);
        if (!match) {
            return false;
        }
        let title = match[3] ? match[3].trim().replaceAll('\n', ' ') : undefined;
        if (!title) {
            return false;
        }

        const currentUserEmail = currentUserPersonalDetails.email ?? '';
        const mention = match[1] ? match[1].trim() : '';
        const currentUserPrivateDomain = isEmailPublicDomain(currentUserEmail) ? '' : Str.extractEmailDomain(currentUserEmail);
        const mentionWithDomain = addDomainToShortMention(mention, availableLoginsList, currentUserPrivateDomain) ?? mention;
        const isValidMention = Str.isValidEmail(mentionWithDomain);

        let assignee: OnyxEntry<OnyxTypes.PersonalDetails>;
        let assigneeChatReport;
        if (mentionWithDomain) {
            if (isValidMention) {
                assignee = Object.values(allPersonalDetails ?? {}).find((pd) => pd?.login === mentionWithDomain) ?? undefined;
                if (!Object.keys(assignee ?? {}).length) {
                    const optimisticDataForNewAssignee = setNewOptimisticAssignee(currentUserPersonalDetails.accountID, {
                        accountID: generateAccountID(mentionWithDomain),
                        login: mentionWithDomain,
                    });
                    assignee = optimisticDataForNewAssignee.assignee;
                    assigneeChatReport = optimisticDataForNewAssignee.assigneeReport;
                }
            } else {
                title = `@${mentionWithDomain} ${title}`;
            }
        }
        createTaskAndNavigate({
            parentReport: report,
            title,
            description: '',
            assigneeEmail: assignee?.login ?? '',
            currentUserAccountID: currentUserPersonalDetails.accountID,
            currentUserEmail,
            assigneeAccountID: assignee?.accountID,
            assigneeChatReport,
            policyID: report?.policyID,
            isCreatedUsingMarkdown: true,
            quickAction,
            ancestors,
        });
        return true;
    };

    const submitForm = (newComment: string) => {
        const newCommentTrimmed = newComment.trim();

        kickoffWaitingIndicator();

        if (attachmentFileRef.current) {
            addAttachmentWithComment({
                report: targetReport,
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
            const isTaskCreated = handleCreateTask(newCommentTrimmed);
            if (isTaskCreated) {
                return;
            }

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

            addComment({
                report: targetReport,
                notifyReportID: reportID,
                ancestors,
                text: newCommentTrimmed,
                timezoneParam: currentUserPersonalDetails.timezone ?? CONST.DEFAULT_TIME_ZONE,
                currentUserAccountID: currentUserPersonalDetails.accountID,
                shouldPlaySound: true,
                isInSidePanel,
                reportActionID: optimisticReportActionID,
            });
        }
    };

    const setPendingDropObjectUrls = (urls: string[]) => {
        pendingDropObjectUrlsRef.current = urls;
    };

    return {submitForm, addAttachment: addAttachmentHandler, onAttachmentPreviewClose, pendingDropObjectUrlsRef, setPendingDropObjectUrls};
}

export default useComposerSubmit;
export type {UseComposerSubmitParams, UseComposerSubmitReturn};
