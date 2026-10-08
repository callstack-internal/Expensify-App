import ONYXKEYS from '@src/ONYXKEYS';
import type {VisibleReportActions} from '@src/types/onyx';

import {getVisibleReportActionsForReports} from '@selectors/VisibleReportActions';
import {useOnyxState} from 'react-native-onyx';

/**
 * The cached visibility of one report's actions, plus its transaction thread's when given, in the `{[reportID]: visibility}`
 * shape `isReportActionVisible` expects. It depends only on those reports' actions, so writes to other reports don't re-run it.
 */
function useVisibleReportActions(reportID: string | undefined, transactionThreadReportID?: string): VisibleReportActions | undefined {
    const reportIDs = [reportID, transactionThreadReportID].filter((id): id is string => !!id);

    return useOnyxState(
        (state) =>
            getVisibleReportActionsForReports(
                reportIDs.map((id) => [id, state[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${id}`]]),
                state[ONYXKEYS.SESSION]?.accountID,
            ),
        {dependencies: [...reportIDs.map((id) => `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${id}` as const), ONYXKEYS.SESSION]},
    );
}

export default useVisibleReportActions;
