import React, {memo} from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import useOnyx from '@hooks/useOnyx';
import useStableReportActionForReportActionItem from '@hooks/useStableReportActionForReportActionItem';
import {isSentMoneyReportAction, isTransactionThread} from '@libs/ReportActionsUtils';
import {isChatThread} from '@libs/ReportUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {PersonalDetailsList, Report, ReportAction} from '@src/types/onyx';
import ReportActionItem from './ReportActionItem';
import ReportActionItemParentAction from './ReportActionItemParentAction';

type ReportActionsListItemRendererProps = {
    /** All the data of the action item */
    reportAction: ReportAction;

    /** The report's parentReportAction */
    parentReportAction: OnyxEntry<ReportAction>;

    /** The transaction thread report's parentReportAction */
    parentReportActionForTransactionThread: OnyxEntry<ReportAction>;

    /** Report for this action */
    report: OnyxEntry<Report>;

    /** The transaction thread report associated with the report for this action, if any */
    transactionThreadReport: OnyxEntry<Report>;

    /** Should the comment have the appearance of being grouped with the previous comment? */
    displayAsGroup: boolean;

    /** If the thread divider line should be hidden */
    shouldHideThreadDividerLine: boolean;

    /** Should we display the new marker on top of the comment? */
    shouldDisplayNewMarker: boolean;

    /** Report action ID that was referenced in the deeplink to report  */
    linkedReportActionID?: string;

    /** Whether we should display "Replies" divider */
    shouldDisplayReplyDivider: boolean;

    /** If this is the first visible report action */
    isFirstVisibleReportAction: boolean;

    /** If the thread divider line will be used */
    shouldUseThreadDividerLine?: boolean;

    /** Animate highlight action in few seconds */
    shouldHighlight?: boolean;

    /** The original report ID for draft message lookups */
    originalReportID: string | undefined;

    /** Personal details list */
    personalDetails: OnyxEntry<PersonalDetailsList>;

    /** Whether the report is archived */
    isReportArchived: boolean;

    /** Whether the action is the "Created" action of a harvest-created expense report */
    isHarvestCreatedExpenseReport?: boolean;
};

function ReportActionsListItemRenderer({
    reportAction,
    parentReportAction,
    report,
    transactionThreadReport,
    displayAsGroup,
    shouldHideThreadDividerLine,
    shouldDisplayNewMarker,
    linkedReportActionID = '',
    shouldDisplayReplyDivider,
    isFirstVisibleReportAction = false,
    shouldUseThreadDividerLine = false,
    shouldHighlight = false,
    parentReportActionForTransactionThread,
    originalReportID,
    personalDetails,
    isReportArchived = false,
    isHarvestCreatedExpenseReport = false,
}: ReportActionsListItemRendererProps) {
    const [reportDraftMessages] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_DRAFTS}${originalReportID}`);
    const draftMessage = reportDraftMessages?.[reportAction.reportActionID]?.message;

    const actionStable = useStableReportActionForReportActionItem(reportAction);

    const shouldDisplayParentAction =
        reportAction.actionName === CONST.REPORT.ACTIONS.TYPE.CREATED && (!isTransactionThread(parentReportAction) || isSentMoneyReportAction(parentReportAction));

    if (shouldDisplayParentAction && isChatThread(report)) {
        return (
            <ReportActionItemParentAction
                shouldHideThreadDividerLine={shouldDisplayParentAction && shouldHideThreadDividerLine}
                shouldDisplayReplyDivider={shouldDisplayReplyDivider}
                parentReportAction={parentReportAction}
                reportID={report.reportID}
                report={report}
                action={actionStable}
                transactionThreadReport={transactionThreadReport}
                isFirstVisibleReportAction={isFirstVisibleReportAction}
                shouldUseThreadDividerLine={shouldUseThreadDividerLine}
                personalDetails={personalDetails}
                isReportArchived={isReportArchived}
            />
        );
    }

    return (
        <ReportActionItem
            shouldHideThreadDividerLine={shouldHideThreadDividerLine}
            parentReportAction={parentReportAction}
            report={report}
            transactionThreadReport={transactionThreadReport}
            parentReportActionForTransactionThread={parentReportActionForTransactionThread}
            action={actionStable}
            linkedReportActionID={linkedReportActionID}
            displayAsGroup={displayAsGroup}
            shouldDisplayNewMarker={shouldDisplayNewMarker}
            isFirstVisibleReportAction={isFirstVisibleReportAction}
            shouldUseThreadDividerLine={shouldUseThreadDividerLine}
            shouldHighlight={shouldHighlight}
            personalDetails={personalDetails}
            draftMessage={draftMessage}
            isHarvestCreatedExpenseReport={isHarvestCreatedExpenseReport}
        />
    );
}

export default memo(ReportActionsListItemRenderer);
