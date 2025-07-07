import {
    getCombinedReportActions,
    getOneTransactionThreadReportID,
    getSortedReportActions,
    isWhisperAction,
    shouldReportActionBeVisible,
    shouldReportActionBeVisibleAsLastAction,
} from '@libs/ReportActionsUtils';
import {canUserPerformWriteAction} from '@libs/ReportUtils';
import createOnyxDerivedValueConfig from '@userActions/OnyxDerived/createOnyxDerivedValueConfig';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportActionsMetadataDerivedValue} from '@src/types/onyx/DerivedValues';

/**
 * This derived value processes report actions to generate metadata for each report:
 * - lastReportAction: The most recent report action for the report
 * - allSortedReportActions: Sorted arrays of report actions for the report
 * - lastVisibleReportAction: The most recent visible report action for the report
 * - lastVisibleReportActionForDisplay: The most recent visible report action suitable for display as the last action in sidebar/LHN
 */
export default createOnyxDerivedValueConfig({
    key: ONYXKEYS.DERIVED.REPORT_ACTIONS_METADATA,
    dependencies: [ONYXKEYS.COLLECTION.REPORT_ACTIONS, ONYXKEYS.COLLECTION.REPORT],
    compute: ([reportActions, reports], {currentValue, sourceValues}) => {
        if (!reportActions) {
            return {};
        }

        const reportActionsUpdates = sourceValues?.[ONYXKEYS.COLLECTION.REPORT_ACTIONS];
        const reportUpdates = sourceValues?.[ONYXKEYS.COLLECTION.REPORT];

        let reportActionsToProcess = Object.keys(reportActions);

        // Only process updated report actions if we have specific updates
        if (reportActionsUpdates) {
            reportActionsToProcess = Object.keys(reportActionsUpdates);
        } else if (reportUpdates && !reportActionsUpdates) {
            // If only reports updated, we need to recompute report actions for affected reports
            reportActionsToProcess = Object.keys(reportUpdates)
                .map((reportKey) => reportKey.replace(ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.COLLECTION.REPORT_ACTIONS))
                .filter((reportActionsKey) => reportActions[reportActionsKey]);
        } else if (!sourceValues) {
            // Initial computation - process all
            reportActionsToProcess = Object.keys(reportActions);
        }

        const result: ReportActionsMetadataDerivedValue = currentValue ?? {};

        for (const reportActionsKey of reportActionsToProcess) {
            const reportID = reportActionsKey.split('_').at(1);
            if (!reportID) {
                // eslint-disable-next-line no-continue
                continue;
            }

            const currentReportActions = reportActions[reportActionsKey];

            // If report actions are deleted/null, clean up
            if (!currentReportActions) {
                delete result[reportID];
                // eslint-disable-next-line no-continue
                continue;
            }

            const reportActionsArray = Object.values(currentReportActions);
            let sortedReportActions = getSortedReportActions(reportActionsArray, true);

            if (!result[reportID]) {
                result[reportID] = {};
            }

            result[reportID].allSortedReportActions = sortedReportActions;

            const report = reports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
            const chatReport = reports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.chatReportID}`];

            // If the report is a one-transaction report, we need to return the combined reportActions so that the LHN can display modifications
            // to the transaction thread or the report itself
            const transactionThreadReportID = getOneTransactionThreadReportID(report, chatReport, currentReportActions);
            if (transactionThreadReportID) {
                const transactionThreadReportActionsArray = Object.values(reportActions[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${transactionThreadReportID}`] ?? {});
                sortedReportActions = getCombinedReportActions(sortedReportActions, transactionThreadReportID, transactionThreadReportActionsArray, reportID);
            }

            const firstReportAction = sortedReportActions.at(0);
            if (!firstReportAction) {
                if (result[reportID]) {
                    delete result[reportID].lastReportAction;
                }
            } else {
                result[reportID].lastReportAction = firstReportAction;
            }

            const isWriteActionAllowed = canUserPerformWriteAction(report);

            // The report is only visible if it is the last action not deleted that
            // does not match a closed or created state.
            const reportActionsForDisplay = sortedReportActions.filter(
                (reportAction, actionKey) =>
                    shouldReportActionBeVisible(reportAction, actionKey, isWriteActionAllowed) &&
                    !isWhisperAction(reportAction) &&
                    reportAction.actionName !== CONST.REPORT.ACTIONS.TYPE.CREATED &&
                    reportAction.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
            );
            const reportActionForDisplay = reportActionsForDisplay.at(0);
            if (!reportActionForDisplay) {
                if (result[reportID]) {
                    delete result[reportID].lastVisibleReportAction;
                }
            } else {
                result[reportID].lastVisibleReportAction = reportActionForDisplay;
            }

            // The report is only visible if it is the last action not deleted that
            // does not match a closed or created state.
            const reportActionsForSidebarDisplay = sortedReportActions.filter(
                (reportAction) => shouldReportActionBeVisibleAsLastAction(reportAction, isWriteActionAllowed) && reportAction.actionName !== CONST.REPORT.ACTIONS.TYPE.CREATED,
            );

            const reportActionForSidebarDisplay = reportActionsForSidebarDisplay.at(0);
            if (!reportActionForSidebarDisplay) {
                if (result[reportID]) {
                    delete result[reportID].lastVisibleReportActionForDisplay;
                }
            } else {
                result[reportID].lastVisibleReportActionForDisplay = reportActionForSidebarDisplay;
            }
        }

        return result;
    },
});
