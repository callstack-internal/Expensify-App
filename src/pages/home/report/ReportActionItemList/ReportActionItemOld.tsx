import lodashIsEqual from 'lodash/isEqual';
import React, {memo, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import type {GestureResponderEvent, TextInput} from 'react-native';
import {InteractionManager, View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import {useOnyx} from 'react-native-onyx';
import type {Emoji} from '@assets/emojis/types';
import {AttachmentContext} from '@components/AttachmentContext';
import Button from '@components/Button';
import DisplayNames from '@components/DisplayNames';
import Hoverable from '@components/Hoverable';
import MentionReportContext from '@components/HTMLEngineProvider/HTMLRenderers/MentionReportRenderer/MentionReportContext';
import Icon from '@components/Icon';
import * as Expensicons from '@components/Icon/Expensicons';
import InlineSystemMessage from '@components/InlineSystemMessage';
import KYCWall from '@components/KYCWall';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import {useBlockedFromConcierge, usePersonalDetails} from '@components/OnyxProvider';
import PressableWithSecondaryInteraction from '@components/PressableWithSecondaryInteraction';
import ReportActionItemEmojiReactions from '@components/Reactions/ReportActionItemEmojiReactions';
import RenderHTML from '@components/RenderHTML';
import type {ActionableItem} from '@components/ReportActionItem/ActionableItemButtons';
import ActionableItemButtons from '@components/ReportActionItem/ActionableItemButtons';
import ChronosOOOListActions from '@components/ReportActionItem/ChronosOOOListActions';
import ExportIntegration from '@components/ReportActionItem/ExportIntegration';
import IssueCardMessage from '@components/ReportActionItem/IssueCardMessage';
import MoneyRequestAction from '@components/ReportActionItem/MoneyRequestAction';
import ReportPreview from '@components/ReportActionItem/ReportPreview';
import TaskAction from '@components/ReportActionItem/TaskAction';
import TaskPreview from '@components/ReportActionItem/TaskPreview';
import TripRoomPreview from '@components/ReportActionItem/TripRoomPreview';
import {ShowContextMenuContext} from '@components/ShowContextMenuContext';
import Text from '@components/Text';
import UnreadActionIndicator from '@components/UnreadActionIndicator';
import useLocalize from '@hooks/useLocalize';
import usePermissions from '@hooks/usePermissions';
import usePrevious from '@hooks/usePrevious';
import useReportScrollManager from '@hooks/useReportScrollManager';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import ControlSelection from '@libs/ControlSelection';
import * as DeviceCapabilities from '@libs/DeviceCapabilities';
import * as ErrorUtils from '@libs/ErrorUtils';
import focusComposerWithDelay from '@libs/focusComposerWithDelay';
import ModifiedExpenseMessage from '@libs/ModifiedExpenseMessage';
import Navigation from '@libs/Navigation/Navigation';
import Permissions from '@libs/Permissions';
import * as PersonalDetailsUtils from '@libs/PersonalDetailsUtils';
import * as PolicyUtils from '@libs/PolicyUtils';
import ReportActionComposeFocusManager from '@libs/ReportActionComposeFocusManager';
import * as ReportActionsUtils from '@libs/ReportActionsUtils';
import * as ReportUtils from '@libs/ReportUtils';
import SelectionScraper from '@libs/SelectionScraper';
import shouldRenderAddPaymentCard from '@libs/shouldRenderAppPaymentCard';
import * as TransactionUtils from '@libs/TransactionUtils';
import {RestrictedReadOnlyContextMenuActions} from '@pages/home/report/ContextMenu/ContextMenuActions';
import MiniReportActionContextMenu from '@pages/home/report/ContextMenu/MiniReportActionContextMenu';
import * as ReportActionContextMenu from '@pages/home/report/ContextMenu/ReportActionContextMenu';
import {hideContextMenu} from '@pages/home/report/ContextMenu/ReportActionContextMenu';
import LinkPreviewer from '@pages/home/report/LinkPreviewer';
import ReportActionItemBasicMessage from '@pages/home/report/ReportActionItemBasicMessage';
import ReportActionItemContentCreated from '@pages/home/report/ReportActionItemContentCreated';
import ReportActionItemDraft from '@pages/home/report/ReportActionItemDraft';
import ReportActionItemGrouped from '@pages/home/report/ReportActionItemGrouped';
import ReportActionItemMessage from '@pages/home/report/ReportActionItemMessage';
import ReportActionItemMessageEdit from '@pages/home/report/ReportActionItemMessageEdit';
import ReportActionItemSingle from '@pages/home/report/ReportActionItemSingle';
import ReportActionItemThread from '@pages/home/report/ReportActionItemThread';
import ReportAttachmentsContext from '@pages/home/report/ReportAttachmentsContext';
import {ReactionListContext} from '@pages/home/ReportScreenContext';
import * as BankAccounts from '@userActions/BankAccounts';
import * as EmojiPickerAction from '@userActions/EmojiPickerAction';
import * as Member from '@userActions/Policy/Member';
import * as Report from '@userActions/Report';
import * as ReportActions from '@userActions/ReportActions';
import * as Session from '@userActions/Session';
import * as Transaction from '@userActions/Transaction';
import * as User from '@userActions/User';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type * as OnyxTypes from '@src/types/onyx';
import type {JoinWorkspaceResolution} from '@src/types/onyx/OriginalMessage';
import {isEmptyObject} from '@src/types/utils/EmptyObject';

type ReportActionItemOldProps = {
    /** Report for this action */
    report: OnyxEntry<OnyxTypes.Report>;

    /** The transaction thread report associated with the report for this action, if any */
    transactionThreadReport?: OnyxEntry<OnyxTypes.Report>;

    /** Array of report actions for the report for this action */
    // eslint-disable-next-line react/no-unused-prop-types
    reportActions: OnyxTypes.ReportAction[];

    /** Report action belonging to the report's parent */
    parentReportAction: OnyxEntry<OnyxTypes.ReportAction>;

    /** The transaction thread report's parentReportAction */
    /** It's used by withOnyx HOC */
    // eslint-disable-next-line react/no-unused-prop-types
    parentReportActionForTransactionThread?: OnyxEntry<OnyxTypes.ReportAction>;

    /** All the data of the action item */
    action: OnyxTypes.ReportAction;

    /** Should the comment have the appearance of being grouped with the previous comment? */
    displayAsGroup: boolean;

    /** Is this the most recent IOU Action? */
    isMostRecentIOUReportAction: boolean;

    /** Should we display the new marker on top of the comment? */
    shouldDisplayNewMarker: boolean;

    /** Determines if the avatar is displayed as a subscript (positioned lower than normal) */
    shouldShowSubscriptAvatar?: boolean;

    /** Position index of the report action in the overall report FlatList view */
    index: number;

    /** Flag to show, hide the thread divider line */
    shouldHideThreadDividerLine?: boolean;

    linkedReportActionID?: string;

    /** Callback to be called on onPress */
    onPress?: () => void;

    /** If this is the first visible report action */
    isFirstVisibleReportAction: boolean;

    /** IF the thread divider line will be used */
    shouldUseThreadDividerLine?: boolean;

    hideThreadReplies?: boolean;

    /** Whether context menu should be displayed */
    shouldDisplayContextMenu?: boolean;

    hovered?: boolean;

    isWhisper?: boolean;

    hasErrors?: boolean;
};

function ReportActionItemOld({
    action,
    report,
    transactionThreadReport,
    linkedReportActionID,
    displayAsGroup,
    index,
    isMostRecentIOUReportAction,
    parentReportAction,
    shouldDisplayNewMarker,
    shouldHideThreadDividerLine = false,
    shouldShowSubscriptAvatar = false,
    onPress = undefined,
    isFirstVisibleReportAction = false,
    shouldUseThreadDividerLine = false,
    hideThreadReplies = false,
    shouldDisplayContextMenu = true,
    parentReportActionForTransactionThread,
    hovered = false,
    isWhisper,
    hasErrors,
}: ReportActionItemOldProps) {
    const {translate} = useLocalize(); // needed here
    const blockedFromConcierge = useBlockedFromConcierge(); // specific in one component
    const reportID = report?.reportID ?? ''; // needed here
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const originalReportID = useMemo(() => ReportUtils.getOriginalReportID(reportID, action) || '-1', [reportID, action]);
    const [draftMessage] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_DRAFTS}${originalReportID}`, {
        selector: (draftMessagesForReport) => {
            const matchingDraftMessage = draftMessagesForReport?.[action.reportActionID];
            return typeof matchingDraftMessage === 'string' ? matchingDraftMessage : matchingDraftMessage?.message;
        },
    });
    const [iouReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${ReportActionsUtils.getIOUReportIDFromReportActionPreview(action) ?? -1}`);
    const [emojiReactions] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS}${action.reportActionID}`);
    const [userWallet] = useOnyx(ONYXKEYS.USER_WALLET);

    const styles = useThemeStyles();
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- This is needed to prevent the app from crashing when the app is using imported state.
    const [reportNameValuePairs] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${report?.reportID || '-1'}`);
    const personalDetails = usePersonalDetails() || CONST.EMPTY_OBJECT;
    const [isContextMenuActive, setIsContextMenuActive] = useState(() => ReportActionContextMenu.isActiveReportAction(action.reportActionID));
    const [isEmojiPickerActive, setIsEmojiPickerActive] = useState<boolean | undefined>();
    const [isPaymentMethodPopoverActive, setIsPaymentMethodPopoverActive] = useState<boolean | undefined>(); // must be sent by above

    const [isHidden, setIsHidden] = useState(false);
    const [moderationDecision, setModerationDecision] = useState<OnyxTypes.DecisionName>(CONST.MODERATION.MODERATOR_DECISION_APPROVED);
    const {updateHiddenAttachments} = useContext(ReportAttachmentsContext);
    const textInputRef = useRef<TextInput | HTMLTextAreaElement>(null);
    const popoverAnchorRef = useRef<Exclude<ReportActionContextMenu.ContextMenuAnchor, TextInput>>(null);
    const [isUserValidated] = useOnyx(ONYXKEYS.USER, {selector: (user) => !!user?.validated});
    const {canUseP2PDistanceRequests} = usePermissions();
    // The app would crash due to subscribing to the entire report collection if parentReportID is an empty string. So we should have a fallback ID here.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const [parentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${report?.parentReportID || -1}`);

    const isActionableWhisper =
        ReportActionsUtils.isActionableMentionWhisper(action) || ReportActionsUtils.isActionableTrackExpense(action) || ReportActionsUtils.isActionableReportMentionWhisper(action);

    const updateHiddenState = useCallback(
        (isHiddenValue: boolean) => {
            setIsHidden(isHiddenValue);
            const message = Array.isArray(action.message) ? action.message?.at(-1) : action.message;
            const isAttachment = ReportUtils.isReportMessageAttachment(message);
            if (!isAttachment) {
                return;
            }
            updateHiddenAttachments(action.reportActionID, isHiddenValue);
        },
        [action.reportActionID, action.message, updateHiddenAttachments],
    );

    // Hide the message if it is being moderated for a higher offense, or is hidden by a moderator
    // Removed messages should not be shown anyway and should not need this flow
    const latestDecision = ReportActionsUtils.getReportActionMessage(action)?.moderationDecision?.decision ?? '';
    useEffect(() => {
        if (action.actionName !== CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT) {
            return;
        }

        // Hide reveal message button and show the message if latestDecision is changed to empty
        if (!latestDecision) {
            setModerationDecision(CONST.MODERATION.MODERATOR_DECISION_APPROVED);
            setIsHidden(false);
            return;
        }

        setModerationDecision(latestDecision);
        if (
            ![CONST.MODERATION.MODERATOR_DECISION_APPROVED, CONST.MODERATION.MODERATOR_DECISION_PENDING].some((item) => item === latestDecision) &&
            !ReportActionsUtils.isPendingRemove(action)
        ) {
            setIsHidden(true);
            return;
        }
        setIsHidden(false);
    }, [latestDecision, action]);

    const toggleContextMenuFromActiveReportAction = useCallback(() => {
        setIsContextMenuActive(ReportActionContextMenu.isActiveReportAction(action.reportActionID));
    }, [action.reportActionID]);

    const isArchivedRoom = ReportUtils.isArchivedRoomWithID(originalReportID);
    const disabledActions = useMemo(() => (!ReportUtils.canWriteInReport(report) ? RestrictedReadOnlyContextMenuActions : []), [report]);
    const isChronosReport = ReportUtils.chatIncludesChronosWithID(originalReportID);
    /**
     * Show the ReportActionContextMenu modal popover.
     *
     * @param [event] - A press event.
     */
    const showPopover = useCallback(
        (event: GestureResponderEvent | MouseEvent) => {
            // Block menu on the message being Edited or if the report action item has errors
            if (draftMessage !== undefined || !isEmptyObject(action.errors) || !shouldDisplayContextMenu) {
                return;
            }

            ReportActionComposeFocusManager.blurAll();
            setIsContextMenuActive(true);
            const selection = SelectionScraper.getCurrentSelection();
            ReportActionContextMenu.showContextMenu(
                CONST.CONTEXT_MENU_TYPES.REPORT_ACTION,
                event,
                selection,
                popoverAnchorRef.current,
                reportID,
                action.reportActionID,
                originalReportID,
                draftMessage ?? '',
                () => setIsContextMenuActive(true),
                toggleContextMenuFromActiveReportAction,
                isArchivedRoom,
                isChronosReport,
                false,
                false,
                disabledActions,
                false,
                setIsEmojiPickerActive as () => void,
            );
        },
        [draftMessage, action, reportID, toggleContextMenuFromActiveReportAction, originalReportID, shouldDisplayContextMenu, disabledActions, isArchivedRoom, isChronosReport],
    );

    const toggleReaction = useCallback(
        (emoji: Emoji, ignoreSkinToneOnCompare?: boolean) => {
            Report.toggleEmojiReaction(reportID, action, emoji, emojiReactions, undefined, ignoreSkinToneOnCompare);
        },
        [reportID, action, emojiReactions],
    );

    const contextValue = useMemo(
        () => ({
            anchor: popoverAnchorRef.current,
            report: {...report, reportID: report?.reportID ?? ''},
            reportNameValuePairs,
            action,
            transactionThreadReport,
            checkIfContextMenuActive: toggleContextMenuFromActiveReportAction,
            isDisabled: false,
        }),
        [report, action, toggleContextMenuFromActiveReportAction, transactionThreadReport, reportNameValuePairs],
    );

    const attachmentContextValue = useMemo(() => ({reportID, type: CONST.ATTACHMENT_TYPE.REPORT}), [reportID]);

    const mentionReportContextValue = useMemo(() => ({currentReportID: report?.reportID ?? '-1'}), [report?.reportID]);

    const actionableItemButtons: ActionableItem[] = useMemo(() => {
        if (ReportActionsUtils.isActionableAddPaymentCard(action) && shouldRenderAddPaymentCard()) {
            return [
                {
                    text: 'subscription.cardSection.addCardButton',
                    key: `${action.reportActionID}-actionableAddPaymentCard-submit`,
                    onPress: () => {
                        Navigation.navigate(ROUTES.SETTINGS_SUBSCRIPTION_ADD_PAYMENT_CARD);
                    },
                    isMediumSized: true,
                    isPrimary: true,
                },
            ];
        }

        if (!isActionableWhisper && (!ReportActionsUtils.isActionableJoinRequest(action) || ReportActionsUtils.getOriginalMessage(action)?.choice !== ('' as JoinWorkspaceResolution))) {
            return [];
        }

        if (ReportActionsUtils.isActionableTrackExpense(action)) {
            const transactionID = ReportActionsUtils.getOriginalMessage(action)?.transactionID;
            return [
                ...(!TransactionUtils.isDistanceRequest(TransactionUtils.getTransaction(transactionID ?? '-1')) || canUseP2PDistanceRequests
                    ? [
                          {
                              text: 'actionableMentionTrackExpense.submit',
                              key: `${action.reportActionID}-actionableMentionTrackExpense-submit`,
                              onPress: () => {
                                  ReportUtils.createDraftTransactionAndNavigateToParticipantSelector(transactionID ?? '0', reportID, CONST.IOU.ACTION.SUBMIT, action.reportActionID);
                              },
                              isMediumSized: true,
                          } as ActionableItem,
                      ]
                    : []),
                {
                    text: 'actionableMentionTrackExpense.categorize',
                    key: `${action.reportActionID}-actionableMentionTrackExpense-categorize`,
                    onPress: () => {
                        ReportUtils.createDraftTransactionAndNavigateToParticipantSelector(transactionID ?? '0', reportID, CONST.IOU.ACTION.CATEGORIZE, action.reportActionID);
                    },
                    isMediumSized: true,
                },
                {
                    text: 'actionableMentionTrackExpense.share',
                    key: `${action.reportActionID}-actionableMentionTrackExpense-share`,
                    onPress: () => {
                        ReportUtils.createDraftTransactionAndNavigateToParticipantSelector(transactionID ?? '0', reportID, CONST.IOU.ACTION.SHARE, action.reportActionID);
                    },
                    isMediumSized: true,
                },
                {
                    text: 'actionableMentionTrackExpense.nothing',
                    key: `${action.reportActionID}-actionableMentionTrackExpense-nothing`,
                    onPress: () => {
                        Report.dismissTrackExpenseActionableWhisper(reportID, action);
                    },
                    isMediumSized: true,
                },
            ];
        }

        if (ReportActionsUtils.isActionableJoinRequest(action)) {
            return [
                {
                    text: 'actionableMentionJoinWorkspaceOptions.accept',
                    key: `${action.reportActionID}-actionableMentionJoinWorkspace-${CONST.REPORT.ACTIONABLE_MENTION_JOIN_WORKSPACE_RESOLUTION.ACCEPT}`,
                    onPress: () => Member.acceptJoinRequest(reportID, action),
                    isPrimary: true,
                },
                {
                    text: 'actionableMentionJoinWorkspaceOptions.decline',
                    key: `${action.reportActionID}-actionableMentionJoinWorkspace-${CONST.REPORT.ACTIONABLE_MENTION_JOIN_WORKSPACE_RESOLUTION.DECLINE}`,
                    onPress: () => Member.declineJoinRequest(reportID, action),
                },
            ];
        }

        if (ReportActionsUtils.isActionableReportMentionWhisper(action)) {
            return [
                {
                    text: 'common.yes',
                    key: `${action.reportActionID}-actionableReportMentionWhisper-${CONST.REPORT.ACTIONABLE_REPORT_MENTION_WHISPER_RESOLUTION.CREATE}`,
                    onPress: () => Report.resolveActionableReportMentionWhisper(reportID, action, CONST.REPORT.ACTIONABLE_REPORT_MENTION_WHISPER_RESOLUTION.CREATE),
                    isPrimary: true,
                },
                {
                    text: 'common.no',
                    key: `${action.reportActionID}-actionableReportMentionWhisper-${CONST.REPORT.ACTIONABLE_REPORT_MENTION_WHISPER_RESOLUTION.NOTHING}`,
                    onPress: () => Report.resolveActionableReportMentionWhisper(reportID, action, CONST.REPORT.ACTIONABLE_REPORT_MENTION_WHISPER_RESOLUTION.NOTHING),
                },
            ];
        }

        return [
            {
                text: 'actionableMentionWhisperOptions.invite',
                key: `${action.reportActionID}-actionableMentionWhisper-${CONST.REPORT.ACTIONABLE_MENTION_WHISPER_RESOLUTION.INVITE}`,
                onPress: () => Report.resolveActionableMentionWhisper(reportID, action, CONST.REPORT.ACTIONABLE_MENTION_WHISPER_RESOLUTION.INVITE),
                isPrimary: true,
            },
            {
                text: 'actionableMentionWhisperOptions.nothing',
                key: `${action.reportActionID}-actionableMentionWhisper-${CONST.REPORT.ACTIONABLE_MENTION_WHISPER_RESOLUTION.NOTHING}`,
                onPress: () => Report.resolveActionableMentionWhisper(reportID, action, CONST.REPORT.ACTIONABLE_MENTION_WHISPER_RESOLUTION.NOTHING),
            },
        ];
    }, [action, isActionableWhisper, reportID, canUseP2PDistanceRequests]);

    /**
     * Get the content of ReportActionItem
     * @param hovered whether the ReportActionItem is hovered
     * @param isWhisper whether the report action is a whisper
     * @param hasErrors whether the report action has any errors
     * @returns child component(s)
     */
    const renderItemContent = (): React.JSX.Element => {
        let children;

        // Show the MoneyRequestPreview for when expense is present
        if (
            ReportActionsUtils.isMoneyRequestAction(action) &&
            ReportActionsUtils.getOriginalMessage(action) &&
            // For the pay flow, we only want to show MoneyRequestAction when sending money. When paying, we display a regular system message
            (ReportActionsUtils.getOriginalMessage(action)?.type === CONST.IOU.REPORT_ACTION_TYPE.CREATE ||
                ReportActionsUtils.getOriginalMessage(action)?.type === CONST.IOU.REPORT_ACTION_TYPE.SPLIT ||
                ReportActionsUtils.getOriginalMessage(action)?.type === CONST.IOU.REPORT_ACTION_TYPE.TRACK)
        ) {
            // There is no single iouReport for bill splits, so only 1:1 requests require an iouReportID
            const iouReportID = ReportActionsUtils.getOriginalMessage(action)?.IOUReportID ? ReportActionsUtils.getOriginalMessage(action)?.IOUReportID?.toString() ?? '-1' : '-1';
            children = (
                <MoneyRequestAction
                    // If originalMessage.iouReportID is set, this is a 1:1 IOU expense in a DM chat whose reportID is report.chatReportID
                    chatReportID={ReportActionsUtils.getOriginalMessage(action)?.IOUReportID ? report?.chatReportID ?? '' : reportID}
                    requestReportID={iouReportID}
                    reportID={reportID}
                    action={action}
                    isMostRecentIOUReportAction={isMostRecentIOUReportAction}
                    isHovered={hovered}
                    contextMenuAnchor={popoverAnchorRef.current}
                    checkIfContextMenuActive={toggleContextMenuFromActiveReportAction}
                    style={displayAsGroup ? [] : [styles.mt2]}
                    isWhisper={isWhisper}
                    shouldDisplayContextMenu={shouldDisplayContextMenu}
                />
            );
        } else if (action.actionName === CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW) {
            children = ReportUtils.isClosedExpenseReportWithNoExpenses(iouReport) ? (
                <RenderHTML html={`<comment>${translate('parentReportAction.deletedReport')}</comment>`} />
            ) : (
                <ReportPreview
                    iouReportID={ReportActionsUtils.getIOUReportIDFromReportActionPreview(action)}
                    chatReportID={reportID}
                    policyID={report?.policyID ?? '-1'}
                    containerStyles={displayAsGroup ? [] : [styles.mt2]}
                    action={action}
                    isHovered={hovered}
                    contextMenuAnchor={popoverAnchorRef.current}
                    checkIfContextMenuActive={toggleContextMenuFromActiveReportAction}
                    onPaymentOptionsShow={() => setIsPaymentMethodPopoverActive(true)}
                    onPaymentOptionsHide={() => setIsPaymentMethodPopoverActive(false)}
                    isWhisper={isWhisper}
                />
            );
        } else if (ReportActionsUtils.isReimbursementQueuedAction(action)) {
            const linkedReport = ReportUtils.isChatThread(report) ? parentReport : report;
            const submitterDisplayName = PersonalDetailsUtils.getDisplayNameOrDefault(personalDetails[linkedReport?.ownerAccountID ?? -1]);
            const paymentType = ReportActionsUtils.getOriginalMessage(action)?.paymentType ?? '';

            const missingPaymentMethod = ReportUtils.getIndicatedMissingPaymentMethod(userWallet, linkedReport?.reportID ?? '-1', action);
            children = (
                <ReportActionItemBasicMessage
                    message={translate(paymentType === CONST.IOU.PAYMENT_TYPE.EXPENSIFY ? 'iou.waitingOnEnabledWallet' : 'iou.waitingOnBankAccount', {submitterDisplayName})}
                >
                    <>
                        {missingPaymentMethod === 'bankAccount' && (
                            <Button
                                success
                                style={[styles.w100, styles.requestPreviewBox]}
                                text={translate('bankAccount.addBankAccount')}
                                onPress={() => BankAccounts.openPersonalBankAccountSetupView(Navigation.getTopmostReportId() ?? linkedReport?.reportID, isUserValidated)}
                                pressOnEnter
                                large
                            />
                        )}
                        {missingPaymentMethod === 'wallet' && (
                            <KYCWall
                                onSuccessfulKYC={() => Navigation.navigate(ROUTES.ENABLE_PAYMENTS)}
                                enablePaymentsRoute={ROUTES.ENABLE_PAYMENTS}
                                addBankAccountRoute={ROUTES.BANK_ACCOUNT_PERSONAL}
                                addDebitCardRoute={ROUTES.SETTINGS_ADD_DEBIT_CARD}
                                chatReportID={linkedReport?.reportID}
                                iouReport={iouReport}
                            >
                                {(triggerKYCFlow, buttonRef) => (
                                    <Button
                                        ref={buttonRef}
                                        success
                                        large
                                        style={[styles.w100, styles.requestPreviewBox]}
                                        text={translate('iou.enableWallet')}
                                        onPress={triggerKYCFlow}
                                    />
                                )}
                            </KYCWall>
                        )}
                    </>
                </ReportActionItemBasicMessage>
            );
        } else if (ReportActionsUtils.isReimbursementDeQueuedAction(action)) {
            children = <ReportActionItemBasicMessage message={ReportUtils.getReimbursementDeQueuedActionMessage(action, report)} />;
        } else if (action.actionName === CONST.REPORT.ACTIONS.TYPE.MODIFIED_EXPENSE) {
            children = <ReportActionItemBasicMessage message={ModifiedExpenseMessage.getForReportAction(reportID, action)} />;
        } else if (
            ReportActionsUtils.isActionOfType(action, CONST.REPORT.ACTIONS.TYPE.SUBMITTED) ||
            ReportActionsUtils.isActionOfType(action, CONST.REPORT.ACTIONS.TYPE.SUBMITTED_AND_CLOSED)
        ) {
            const wasSubmittedViaHarvesting = ReportActionsUtils.getOriginalMessage(action)?.harvesting ?? false;
            if (wasSubmittedViaHarvesting) {
                children = (
                    <ReportActionItemBasicMessage message="">
                        <RenderHTML html={`<comment><muted-text>${ReportUtils.getReportAutomaticallySubmittedMessage(action)}</muted-text></comment>`} />
                    </ReportActionItemBasicMessage>
                );
            } else {
                children = <ReportActionItemBasicMessage message={ReportUtils.getIOUSubmittedMessage(action)} />;
            }
        } else if (ReportActionsUtils.isActionOfType(action, CONST.REPORT.ACTIONS.TYPE.APPROVED)) {
            const wasAutoApproved = ReportActionsUtils.getOriginalMessage(action)?.automaticAction ?? false;
            if (wasAutoApproved) {
                children = (
                    <ReportActionItemBasicMessage message="">
                        <RenderHTML html={`<comment><muted-text>${ReportUtils.getReportAutomaticallyApprovedMessage(action)}</muted-text></comment>`} />
                    </ReportActionItemBasicMessage>
                );
            } else {
                children = <ReportActionItemBasicMessage message={ReportUtils.getIOUApprovedMessage(action)} />;
            }
        } else if (ReportActionsUtils.isUnapprovedAction(action)) {
            children = <ReportActionItemBasicMessage message={ReportUtils.getIOUUnapprovedMessage(action)} />;
        } else if (ReportActionsUtils.isActionOfType(action, CONST.REPORT.ACTIONS.TYPE.FORWARDED)) {
            const wasAutoForwarded = ReportActionsUtils.getOriginalMessage(action)?.automaticAction ?? false;
            if (wasAutoForwarded) {
                children = (
                    <ReportActionItemBasicMessage message="">
                        <RenderHTML html={`<comment><muted-text>${ReportUtils.getReportAutomaticallyForwardedMessage(action, reportID)}</muted-text></comment>`} />
                    </ReportActionItemBasicMessage>
                );
            } else {
                children = <ReportActionItemBasicMessage message={ReportUtils.getIOUForwardedMessage(action, report)} />;
            }
        } else if (action.actionName === CONST.REPORT.ACTIONS.TYPE.REJECTED) {
            children = <ReportActionItemBasicMessage message={translate('iou.rejectedThisReport')} />;
        } else if (action.actionName === CONST.REPORT.ACTIONS.TYPE.HOLD) {
            children = <ReportActionItemBasicMessage message={translate('iou.heldExpense')} />;
        } else if (action.actionName === CONST.REPORT.ACTIONS.TYPE.HOLD_COMMENT) {
            children = <ReportActionItemBasicMessage message={ReportActionsUtils.getReportActionText(action)} />;
        } else if (action.actionName === CONST.REPORT.ACTIONS.TYPE.UNHOLD) {
            children = <ReportActionItemBasicMessage message={translate('iou.unheldExpense')} />;
        } else if (action.actionName === CONST.REPORT.ACTIONS.TYPE.MERGED_WITH_CASH_TRANSACTION) {
            children = <ReportActionItemBasicMessage message={translate('systemMessage.mergedWithCashTransaction')} />;
        } else if (ReportActionsUtils.isActionOfType(action, CONST.REPORT.ACTIONS.TYPE.DISMISSED_VIOLATION)) {
            children = <ReportActionItemBasicMessage message={ReportActionsUtils.getDismissedViolationMessageText(ReportActionsUtils.getOriginalMessage(action))} />;
        } else if (ReportActionsUtils.isTagModificationAction(action.actionName)) {
            children = <ReportActionItemBasicMessage message={PolicyUtils.getCleanedTagName(ReportActionsUtils.getReportActionMessage(action)?.text ?? '')} />;
        } else if (action.actionName === CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.UPDATE_NAME) {
            children = <ReportActionItemBasicMessage message={ReportUtils.getWorkspaceNameUpdatedMessage(action)} />;
        } else if (action.actionName === CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.ADD_EMPLOYEE) {
            children = <ReportActionItemBasicMessage message={ReportActionsUtils.getPolicyChangeLogAddEmployeeMessage(action)} />;
        } else if (action.actionName === CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.UPDATE_EMPLOYEE) {
            children = <ReportActionItemBasicMessage message={ReportActionsUtils.getPolicyChangeLogChangeRoleMessage(action)} />;
        } else if (action.actionName === CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.DELETE_EMPLOYEE) {
            children = <ReportActionItemBasicMessage message={ReportActionsUtils.getPolicyChangeLogDeleteMemberMessage(action)} />;
        } else if (ReportActionsUtils.isActionOfType(action, CONST.REPORT.ACTIONS.TYPE.REMOVED_FROM_APPROVAL_CHAIN)) {
            children = <ReportActionItemBasicMessage message={ReportActionsUtils.getRemovedFromApprovalChainMessage(action)} />;
        } else if (
            ReportActionsUtils.isActionOfType(action, CONST.REPORT.ACTIONS.TYPE.CARD_ISSUED, CONST.REPORT.ACTIONS.TYPE.CARD_ISSUED_VIRTUAL, CONST.REPORT.ACTIONS.TYPE.CARD_MISSING_ADDRESS)
        ) {
            children = (
                <IssueCardMessage
                    action={action}
                    policyID={report?.policyID}
                />
            );
        } else if (ReportActionsUtils.isActionOfType(action, CONST.REPORT.ACTIONS.TYPE.EXPORTED_TO_INTEGRATION)) {
            children = <ExportIntegration action={action} />;
        } else if (ReportActionsUtils.isRenamedAction(action)) {
            const message = ReportActionsUtils.getRenamedAction(action);
            children = <ReportActionItemBasicMessage message={message} />;
        } else if (ReportActionsUtils.isActionOfType(action, CONST.REPORT.ACTIONS.TYPE.INTEGRATION_SYNC_FAILED)) {
            const {label, errorMessage} = ReportActionsUtils.getOriginalMessage(action) ?? {label: '', errorMessage: ''};
            children = <ReportActionItemBasicMessage message={translate('report.actions.type.integrationSyncFailed', {label, errorMessage})} />;
        } else if (ReportActionsUtils.isActionOfType(action, CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.DELETE_INTEGRATION)) {
            children = <ReportActionItemBasicMessage message={ReportActionsUtils.getRemovedConnectionMessage(action)} />;
            const hasBeenFlagged =
                ![CONST.MODERATION.MODERATOR_DECISION_APPROVED, CONST.MODERATION.MODERATOR_DECISION_PENDING].some((item) => item === moderationDecision) &&
                !ReportActionsUtils.isPendingRemove(action);
            children = (
                <MentionReportContext.Provider value={mentionReportContextValue}>
                    <ShowContextMenuContext.Provider value={contextValue}>
                        <AttachmentContext.Provider value={attachmentContextValue}>
                            {draftMessage === undefined ? (
                                <View style={displayAsGroup && hasBeenFlagged ? styles.blockquote : {}}>
                                    <ReportActionItemMessage
                                        reportID={reportID}
                                        action={action}
                                        displayAsGroup={displayAsGroup}
                                        isHidden={isHidden}
                                    />
                                    {hasBeenFlagged && (
                                        <Button
                                            small
                                            style={[styles.mt2, styles.alignSelfStart]}
                                            onPress={() => updateHiddenState(!isHidden)}
                                        >
                                            <Text
                                                style={[styles.buttonSmallText, styles.userSelectNone]}
                                                dataSet={{[CONST.SELECTION_SCRAPER_HIDDEN_ELEMENT]: true}}
                                            >
                                                {isHidden ? translate('moderation.revealMessage') : translate('moderation.hideMessage')}
                                            </Text>
                                        </Button>
                                    )}
                                    {/**
                                These are the actionable buttons that appear at the bottom of a Concierge message
                                for example: Invite a user mentioned but not a member of the room
                                https://github.com/Expensify/App/issues/32741
                            */}
                                    {actionableItemButtons.length > 0 && (
                                        <ActionableItemButtons
                                            items={actionableItemButtons}
                                            layout={ReportActionsUtils.isActionableTrackExpense(action) ? 'vertical' : 'horizontal'}
                                        />
                                    )}
                                </View>
                            ) : (
                                <ReportActionItemMessageEdit
                                    action={action}
                                    draftMessage={draftMessage}
                                    reportID={reportID}
                                    policyID={report?.policyID}
                                    index={index}
                                    ref={textInputRef}
                                    shouldDisableEmojiPicker={
                                        (ReportUtils.chatIncludesConcierge(report) && User.isBlockedFromConcierge(blockedFromConcierge)) ||
                                        ReportUtils.isArchivedRoom(report, reportNameValuePairs)
                                    }
                                    isGroupPolicyReport={!!report?.policyID && report.policyID !== CONST.POLICY.ID_FAKE}
                                />
                            )}
                        </AttachmentContext.Provider>
                    </ShowContextMenuContext.Provider>
                </MentionReportContext.Provider>
            );
        }
        const numberOfThreadReplies = action.childVisibleActionCount ?? 0;

        const shouldDisplayThreadReplies = !hideThreadReplies && ReportUtils.shouldDisplayThreadReplies(action, reportID);
        const oldestFourAccountIDs =
            action.childOldestFourAccountIDs
                ?.split(',')
                .map((accountID) => Number(accountID))
                .filter((accountID): accountID is number => typeof accountID === 'number') ?? [];
        const draftMessageRightAlign = draftMessage !== undefined ? styles.chatItemReactionsDraftRight : {};

        return (
            <>
                {children}
                {Permissions.canUseLinkPreviews() && !isHidden && (action.linkMetadata?.length ?? 0) > 0 && (
                    <View style={draftMessage !== undefined ? styles.chatItemReactionsDraftRight : {}}>
                        <LinkPreviewer linkMetadata={action.linkMetadata?.filter((item) => !isEmptyObject(item))} />
                    </View>
                )}
                {!ReportActionsUtils.isMessageDeleted(action) && (
                    <View style={draftMessageRightAlign}>
                        <ReportActionItemEmojiReactions
                            reportAction={action}
                            emojiReactions={emojiReactions}
                            shouldBlockReactions={hasErrors}
                            toggleReaction={(emoji, ignoreSkinToneOnCompare) => {
                                if (Session.isAnonymousUser()) {
                                    hideContextMenu(false);

                                    InteractionManager.runAfterInteractions(() => {
                                        Session.signOutAndRedirectToSignIn();
                                    });
                                } else {
                                    toggleReaction(emoji, ignoreSkinToneOnCompare);
                                }
                            }}
                            setIsEmojiPickerActive={setIsEmojiPickerActive}
                        />
                    </View>
                )}

                {shouldDisplayThreadReplies && (
                    <View style={draftMessageRightAlign}>
                        <ReportActionItemThread
                            childReportID={`${action.childReportID}`}
                            numberOfReplies={numberOfThreadReplies}
                            mostRecentReply={`${action.childLastVisibleActionCreated}`}
                            isHovered={hovered}
                            icons={ReportUtils.getIconsForParticipants(oldestFourAccountIDs, personalDetails)}
                            onSecondaryInteraction={showPopover}
                        />
                    </View>
                )}
            </>
        );
    };

    /**
     * Get ReportActionItem with a proper wrapper
     * @param hovered whether the ReportActionItem is hovered
     * @param isWhisper whether the ReportActionItem is a whisper
     * @param hasErrors whether the report action has any errors
     * @returns report action item
     */

    const renderReportActionItem = (): React.JSX.Element => {
        const content = renderItemContent();

        if (draftMessage !== undefined) {
            return <ReportActionItemDraft>{content}</ReportActionItemDraft>;
        }

        if (!displayAsGroup) {
            return (
                <ReportActionItemSingle
                    action={action}
                    showHeader={draftMessage === undefined}
                    wrapperStyle={isWhisper ? styles.pt1 : {}}
                    shouldShowSubscriptAvatar={shouldShowSubscriptAvatar}
                    report={report}
                    iouReport={iouReport}
                    isHovered={hovered}
                    hasBeenFlagged={
                        ![CONST.MODERATION.MODERATOR_DECISION_APPROVED, CONST.MODERATION.MODERATOR_DECISION_PENDING].some((item) => item === moderationDecision) &&
                        !ReportActionsUtils.isPendingRemove(action)
                    }
                >
                    {content}
                </ReportActionItemSingle>
            );
        }

        return <ReportActionItemGrouped wrapperStyle={isWhisper ? styles.pt1 : {}}>{content}</ReportActionItemGrouped>;
    };

    return renderReportActionItem();
}

export default memo(ReportActionItemOld, (prevProps, nextProps) => {
    const prevParentReportAction = prevProps.parentReportAction;
    const nextParentReportAction = nextProps.parentReportAction;
    return (
        prevProps.displayAsGroup === nextProps.displayAsGroup &&
        prevProps.isMostRecentIOUReportAction === nextProps.isMostRecentIOUReportAction &&
        prevProps.shouldDisplayNewMarker === nextProps.shouldDisplayNewMarker &&
        lodashIsEqual(prevProps.action, nextProps.action) &&
        lodashIsEqual(prevProps.report?.pendingFields, nextProps.report?.pendingFields) &&
        lodashIsEqual(prevProps.report?.isDeletedParentAction, nextProps.report?.isDeletedParentAction) &&
        lodashIsEqual(prevProps.report?.errorFields, nextProps.report?.errorFields) &&
        prevProps.report?.statusNum === nextProps.report?.statusNum &&
        prevProps.report?.stateNum === nextProps.report?.stateNum &&
        prevProps.report?.parentReportID === nextProps.report?.parentReportID &&
        prevProps.report?.parentReportActionID === nextProps.report?.parentReportActionID &&
        // TaskReport's created actions render the TaskView, which updates depending on certain fields in the TaskReport
        ReportUtils.isTaskReport(prevProps.report) === ReportUtils.isTaskReport(nextProps.report) &&
        prevProps.action.actionName === nextProps.action.actionName &&
        prevProps.report?.reportName === nextProps.report?.reportName &&
        prevProps.report?.description === nextProps.report?.description &&
        ReportUtils.isCompletedTaskReport(prevProps.report) === ReportUtils.isCompletedTaskReport(nextProps.report) &&
        prevProps.report?.managerID === nextProps.report?.managerID &&
        prevProps.shouldHideThreadDividerLine === nextProps.shouldHideThreadDividerLine &&
        prevProps.report?.total === nextProps.report?.total &&
        prevProps.report?.nonReimbursableTotal === nextProps.report?.nonReimbursableTotal &&
        prevProps.report?.policyAvatar === nextProps.report?.policyAvatar &&
        prevProps.linkedReportActionID === nextProps.linkedReportActionID &&
        lodashIsEqual(prevProps.report?.fieldList, nextProps.report?.fieldList) &&
        lodashIsEqual(prevProps.transactionThreadReport, nextProps.transactionThreadReport) &&
        lodashIsEqual(prevProps.reportActions, nextProps.reportActions) &&
        lodashIsEqual(prevParentReportAction, nextParentReportAction)
    );
});
