import type {OnyxCollection} from 'react-native-onyx';
import {getCombinedReportActions, getOneTransactionThreadReportID, getSortedReportActions, isWhisperAction, shouldReportActionBeVisible} from '@libs/ReportActionsUtils';
import {canUserPerformWriteAction} from '@libs/ReportUtils';
import createOnyxDerivedValueConfig from '@userActions/OnyxDerived/createOnyxDerivedValueConfig';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportActions} from '@src/types/onyx';

let previousReportActions: OnyxCollection<ReportActions> = {};

/**
 * This derived value processes report actions to generate metadata for each report:
 * - lastReportAction: The most recent report action for the report
 * - allSortedReportActions: Sorted arrays of report actions for the report
 * - lastVisibleReportAction: The most recent visible report action for the report
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
            // If only reports updated, we might need to recompute for affected reports
            reportActionsToProcess = Object.keys(reportUpdates)
                .map((reportKey) => reportKey.replace(ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.COLLECTION.REPORT_ACTIONS))
                .filter((reportActionsKey) => reportActions[reportActionsKey]);
        } else if (!sourceValues) {
            // Initial computation - process all
            reportActionsToProcess = Object.keys(reportActions);
        } else {
            // No relevant updates, return current value
            return currentValue ?? {};
        }

        const result = currentValue ?? {};

        // Process each report actions collection
        for (const reportActionsKey of reportActionsToProcess) {
            const reportID = reportActionsKey.split('_').at(1);
            if (!reportID) {
                continue;
            }

            const currentReportActions = reportActions[reportActionsKey];
            const previousReportActionsForReport = previousReportActions?.[reportActionsKey];

            // If report actions are deleted/null, clean up
            if (!currentReportActions) {
                delete result[reportID];
                continue;
            }

            // Skip processing if the report actions haven't actually changed
            if (currentReportActions === previousReportActionsForReport) {
                continue;
            }

            const reportActionsArray = Object.values(currentReportActions);
            let sortedReportActions = getSortedReportActions(reportActionsArray, true);

            // Initialize report metadata object if it doesn't exist
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
                delete result[reportID]?.lastReportAction;
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
                delete result[reportID]?.lastVisibleReportAction;
            } else {
                result[reportID].lastVisibleReportAction = reportActionForDisplay;
            }
        }

        // Update the previous state for next computation
        previousReportActions = reportActions;

        return result;
    },
});
