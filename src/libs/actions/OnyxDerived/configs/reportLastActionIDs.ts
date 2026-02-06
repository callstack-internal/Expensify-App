import type {OnyxEntry} from 'react-native-onyx';
import {getSortedReportActions, getSortedReportActionsForDisplay, shouldReportActionBeVisibleAsLastAction} from '@libs/ReportActionsUtils';
import {canUserPerformWriteAction} from '@libs/ReportUtils';
import {createLazyOnyxDerivedValueConfig} from '@userActions/OnyxDerived/createOnyxDerivedValueConfig';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, ReportActions, ReportNameValuePairs} from '@src/types/onyx';

export default createLazyOnyxDerivedValueConfig({
    key: ONYXKEYS.DERIVED.REPORT_LAST_ACTION_IDS,
    lazy: true,
    dependencies: [ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.COLLECTION.REPORT_ACTIONS, ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS],

    getInvalidatedItems: (changedDependencyKey, sourceValues) => {
        if (sourceValues) {
            const itemKeys = new Set<string>();
            const collectionPrefixes = [ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.COLLECTION.REPORT_ACTIONS, ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS] as const;

            for (const [, changedItems] of Object.entries(sourceValues)) {
                if (!changedItems || typeof changedItems !== 'object') {
                    continue;
                }

                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                for (const fullKey of Object.keys(changedItems)) {
                    for (const prefix of collectionPrefixes) {
                        if (fullKey.startsWith(prefix)) {
                            itemKeys.add(fullKey.replace(prefix, ''));
                            break;
                        }
                    }
                }
            }

            if (itemKeys.size > 0) {
                return itemKeys;
            }
        }

        return undefined;
    },

    computeItem: (reportID, [allReports, allReportActions, allReportNameValuePairs]) => {
        const report: OnyxEntry<Report> = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
        if (!report) {
            return {lastVisibleActionID: undefined, lastReportActionID: undefined};
        }

        const itemReportActions: OnyxEntry<ReportActions> = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`];
        const itemReportNameValuePairs: OnyxEntry<ReportNameValuePairs> = allReportNameValuePairs?.[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${reportID}`];

        const isReportArchived = !!itemReportNameValuePairs?.private_isArchived;
        const canUserPerformWrite = canUserPerformWriteAction(report, isReportArchived);

        // Block 1: getSortedReportActionsForDisplay → descending, .at(0) = most recent
        const sortedForDisplay = getSortedReportActionsForDisplay(itemReportActions, canUserPerformWrite);
        const lastReportActionID = sortedForDisplay.at(0)?.reportActionID;

        // Block 2: getSortedReportActions → ascending, filter visible + not CREATED, .at(-1) = last visible
        let lastVisibleActionID: string | undefined;
        if (itemReportActions) {
            const actionsArray = getSortedReportActions(Object.values(itemReportActions));
            const reportActionsForDisplay = actionsArray.filter(
                (reportAction) => shouldReportActionBeVisibleAsLastAction(reportAction, canUserPerformWrite) && reportAction.actionName !== CONST.REPORT.ACTIONS.TYPE.CREATED,
            );
            lastVisibleActionID = reportActionsForDisplay.at(-1)?.reportActionID;
        }

        return {lastVisibleActionID, lastReportActionID};
    },
});
