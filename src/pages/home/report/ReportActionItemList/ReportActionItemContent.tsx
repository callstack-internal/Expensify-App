import React, {useMemo} from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import {AttachmentContext} from '@components/AttachmentContext';
import Button from '@components/Button';
import MentionReportContext from '@components/HTMLEngineProvider/HTMLRenderers/MentionReportRenderer/MentionReportContext';
import {useBlockedFromConcierge} from '@components/OnyxProvider';
import ActionableItemButtons from '@components/ReportActionItem/ActionableItemButtons';
import type {ActionableItem} from '@components/ReportActionItem/ActionableItemButtons';
import {ShowContextMenuContext} from '@components/ShowContextMenuContext';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import usePermissions from '@hooks/usePermissions';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import * as ReportActionsUtils from '@libs/ReportActionsUtils';
import * as ReportUtils from '@libs/ReportUtils';
import shouldRenderAddPaymentCard from '@libs/shouldRenderAppPaymentCard';
import * as TransactionUtils from '@libs/TransactionUtils';
import ReportActionItemMessage from '@pages/home/report/ReportActionItemMessage';
import ReportActionItemMessageEdit from '@pages/home/report/ReportActionItemMessageEdit';
import * as Member from '@userActions/Policy/Member';
import * as Report from '@userActions/Report';
import * as User from '@userActions/User';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type * as OnyxTypes from '@src/types/onyx';
import type {JoinWorkspaceResolution} from '@src/types/onyx/OriginalMessage';

type Props = {
    reportID: string;
    action: OnyxTypes.ReportAction;
    displayAsGroup: boolean;
    isHidden: boolean;
    hasBeenFlagged: boolean;
    updateHiddenState: (isHidden: boolean) => void;
    report: OnyxTypes.Report;
    index: number;
    textInputRef: React.RefObject<any>;
};

function ReportActionItemContent({reportID, action, displayAsGroup, isHidden, hasBeenFlagged, updateHiddenState, report, index, textInputRef}: Props) {
    const originalReportID = useMemo(() => ReportUtils.getOriginalReportID(reportID, action) ?? '-1', [reportID, action]);
    const [draftMessage] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_DRAFTS}${originalReportID}`, {
        selector: (draftMessagesForReport) => {
            const matchingDraftMessage = draftMessagesForReport?.[action.reportActionID];
            return typeof matchingDraftMessage === 'string' ? matchingDraftMessage : matchingDraftMessage?.message;
        },
    });
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const isActionableWhisper =
        ReportActionsUtils.isActionableMentionWhisper(action) || ReportActionsUtils.isActionableTrackExpense(action) || ReportActionsUtils.isActionableReportMentionWhisper(action);
    const [reportNameValuePairs] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${report?.reportID || '-1'}`);
    const blockedFromConcierge = useBlockedFromConcierge();
    const mentionReportContextValue = useMemo(() => ({currentReportID: report?.reportID ?? '-1'}), [report?.reportID]);
    const attachmentContextValue = useMemo(() => ({reportID, type: CONST.ATTACHMENT_TYPE.REPORT}), [reportID]);
    const contextValue = useMemo(
        () => ({
            // anchor: popoverAnchorRef.current,
            report: {...report, reportID: report?.reportID ?? ''},
            reportNameValuePairs,
            action,
            // transactionThreadReport,
            // checkIfContextMenuActive: toggleContextMenuFromActiveReportAction,
            isDisabled: false,
        }),
        [report, reportNameValuePairs, action],
    );
    const {canUseP2PDistanceRequests} = usePermissions();

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
    }, [action, isActionableWhisper, canUseP2PDistanceRequests, reportID]);

    return (
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
                                (ReportUtils.chatIncludesConcierge(report) && User.isBlockedFromConcierge(blockedFromConcierge)) || ReportUtils.isArchivedRoom(report, reportNameValuePairs)
                            }
                            isGroupPolicyReport={!!report?.policyID && report.policyID !== CONST.POLICY.ID_FAKE}
                        />
                    )}
                </AttachmentContext.Provider>
            </ShowContextMenuContext.Provider>
        </MentionReportContext.Provider>
    );
}

export default ReportActionItemContent;
