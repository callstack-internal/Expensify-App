import ONYXKEYS from '@src/ONYXKEYS';
import type {VisibleReportActions} from '@src/types/onyx';

import {getVisibleReportActionsForReports} from '@selectors/VisibleReportActions';
import {useOnyxState} from 'react-native-onyx';

/**
 * The cached visibility of one report's actions, plus its transaction thread's when given, in the `{[reportID]: visibility}`
 * shape `isReportActionVisible` expects. It depends only on those reports' actions and support ticket state, so writes to other reports don't re-run it.
 */
function useVisibleReportActions(reportID: string | undefined, transactionThreadReportID?: string): VisibleReportActions | undefined {
    const reportIDs = [reportID, transactionThreadReportID].filter((id): id is string => !!id);

    return useOnyxState(
        (state) =>
            getVisibleReportActionsForReports(
                reportIDs.map((id) => [
                    id,
                    state[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${id}`],
                    state[`${ONYXKEYS.COLLECTION.REPORT}${id}`],
                    state[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${id}`],
                ]),
                state[ONYXKEYS.SESSION]?.accountID,
            ),
        {
            dependencies: [
                ...reportIDs.flatMap(
                    (id) => [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${id}`, `${ONYXKEYS.COLLECTION.REPORT}${id}`, `${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${id}`] as const,
                ),
                ONYXKEYS.SESSION,
            ],
        },
    );
}

export default useVisibleReportActions;
