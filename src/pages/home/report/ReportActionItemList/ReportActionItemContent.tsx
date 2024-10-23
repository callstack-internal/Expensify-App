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
import useThemeStyles from '@hooks/useThemeStyles';
import * as ReportActionsUtils from '@libs/ReportActionsUtils';
import * as ReportUtils from '@libs/ReportUtils';
import ReportActionItemMessage from '@pages/home/report/ReportActionItemMessage';
import ReportActionItemMessageEdit from '@pages/home/report/ReportActionItemMessageEdit';
import * as User from '@userActions/User';
import CONST from '@src/CONST';
import type * as OnyxTypes from '@src/types/onyx';

type Props = {
    mentionReportContextValue: {currentReportID: string};
    contextValue: {
        anchor: any;
        report: OnyxTypes.Report;
        action: OnyxTypes.ReportAction;
        checkIfContextMenuActive: () => void;
    };
    attachmentContextValue: {reportID: string; type: string};
    draftMessage: string | undefined;
    reportID: string;
    action: OnyxTypes.ReportAction;
    displayAsGroup: boolean;
    isHidden: boolean;
    hasBeenFlagged: boolean;
    updateHiddenState: (isHidden: boolean) => void;
    actionableItemButtons: ActionableItem[];
    report: OnyxTypes.Report;
    blockedFromConcierge: boolean;
    reportNameValuePairs: Record<string, any>;
    index: number;
    textInputRef: React.RefObject<any>;
};

function ReportActionItemContent({
    // draftMessage,
    reportID,
    action,
    displayAsGroup,
    isHidden,
    hasBeenFlagged,
    updateHiddenState,
    actionableItemButtons,
    report,
    reportNameValuePairs,
    index,
    textInputRef,
}: Props) {
    const originalReportID = useMemo(() => ReportUtils.getOriginalReportID(reportID, action) ?? '-1', [reportID, action]);
    const [draftMessage] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_DRAFTS}${originalReportID}`, {
        selector: (draftMessagesForReport) => {
            const matchingDraftMessage = draftMessagesForReport?.[action.reportActionID];
            return typeof matchingDraftMessage === 'string' ? matchingDraftMessage : matchingDraftMessage?.message;
        },
    });
    console.log('draftMessage', draftMessage);
    const styles = useThemeStyles();
    const {translate} = useLocalize();
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
        [report, action, reportNameValuePairs],
    );

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
