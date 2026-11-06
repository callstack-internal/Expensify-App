import ONYXKEYS from '@src/ONYXKEYS';
import type {VisibleReportActions} from '@src/types/onyx';

import {getVisibleReportActionsForReports} from '@selectors/VisibleReportActions';
import {useOnyxState} from 'react-native-onyx';

/**
 * The cached visibility of one report's actions, plus its transaction thread's when given, in the `{[reportID]: visibility}`
 * shape `isReportActionVisible` expects. It depends only on those reports' actions, ticket state and the user, so writes to other reports don't re-run it.
 */
function useVisibleReportActions(reportID: string | undefined, transactionThreadReportID?: string): VisibleReportActions | undefined {
    const reportIDs = [reportID, transactionThreadReportID].filter((id): id is string => !!id);

    return useOnyxState(
        (state) =>
            getVisibleReportActionsForReports(
                reportIDs.map((id) => ({
                    reportID: id,
                    reportActions: state[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${id}`],
                    report: state[`${ONYXKEYS.COLLECTION.REPORT}${id}`],
                    reportNameValuePairs: state[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${id}`],
                })),
                state[ONYXKEYS.SESSION]?.accountID,
            ),
        {
            dependencies: [
                ...reportIDs.flatMap((id) => [
                    `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${id}` as const,
                    `${ONYXKEYS.COLLECTION.REPORT}${id}` as const,
                    `${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${id}` as const,
                ]),
                ONYXKEYS.SESSION,
            ],
        },
    );
}

export default useVisibleReportActions;
