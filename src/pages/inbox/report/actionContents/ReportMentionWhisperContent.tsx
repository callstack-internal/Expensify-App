import React from 'react';
import {View} from 'react-native';
import MentionReportContext from '@components/HTMLEngineProvider/HTMLRenderers/MentionReportRenderer/MentionReportContext';
import type {ActionableItem} from '@components/ReportActionItem/ActionableItemButtons';
import ActionableItemButtons from '@components/ReportActionItem/ActionableItemButtons';
import useOnyx from '@hooks/useOnyx';
import {getOriginalMessage} from '@libs/ReportActionsUtils';
import ReportActionItemMessage from '@pages/inbox/report/ReportActionItemMessage';
import {resolveActionableReportMentionWhisper} from '@userActions/Report';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportAction} from '@src/types/onyx';

type ReportMentionWhisperContentProps = {
    action: ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.ACTIONABLE_REPORT_MENTION_WHISPER>;
    reportID: string | undefined;
    actionReportID: string | undefined;
    isReportArchived: boolean;
};

function ReportMentionWhisperContent({action, reportID, actionReportID, isReportArchived}: ReportMentionWhisperContentProps) {
    const resolution = getOriginalMessage(action)?.resolution;
    const mentionReportContextValue = {currentReportID: reportID, exactlyMatch: true};

    // Subscribe to the full report here — the resolve action needs heartbeat fields (`lastMessageText`,
    // `lastVisibleActionCreated`, `lastActorAccountID`) for its failure-revert payload.
    const [actionReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${actionReportID}`);

    const buttons: ActionableItem[] = resolution
        ? []
        : [
              {
                  text: 'common.yes',
                  key: `${action.reportActionID}-actionableReportMentionWhisper-${CONST.REPORT.ACTIONABLE_REPORT_MENTION_WHISPER_RESOLUTION.CREATE}`,
                  onPress: () => resolveActionableReportMentionWhisper(actionReport, action, CONST.REPORT.ACTIONABLE_REPORT_MENTION_WHISPER_RESOLUTION.CREATE, isReportArchived),
                  isPrimary: true,
              },
              {
                  text: 'common.no',
                  key: `${action.reportActionID}-actionableReportMentionWhisper-${CONST.REPORT.ACTIONABLE_REPORT_MENTION_WHISPER_RESOLUTION.NOTHING}`,
                  onPress: () => resolveActionableReportMentionWhisper(actionReport, action, CONST.REPORT.ACTIONABLE_REPORT_MENTION_WHISPER_RESOLUTION.NOTHING, isReportArchived),
              },
          ];

    return (
        <MentionReportContext.Provider value={mentionReportContextValue}>
            <View>
                <ReportActionItemMessage
                    action={action}
                    reportID={reportID}
                    displayAsGroup
                />
                {buttons.length > 0 && (
                    <ActionableItemButtons
                        items={buttons}
                        shouldUseLocalization
                        layout="horizontal"
                    />
                )}
            </View>
        </MentionReportContext.Provider>
    );
}

ReportMentionWhisperContent.displayName = 'ReportMentionWhisperContent';

export default ReportMentionWhisperContent;
