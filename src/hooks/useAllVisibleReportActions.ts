import ONYXKEYS from '@src/ONYXKEYS';
import type {VisibleReportActions} from '@src/types/onyx';

import {getAllVisibleReportActions} from '@selectors/VisibleReportActions';
import {useOnyxState} from 'react-native-onyx';

const dependencies = [ONYXKEYS.COLLECTION.REPORT_ACTIONS, ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS, ONYXKEYS.SESSION] as const;

/** The cached visibility of every report's actions, keyed by reportID. Reads live data, also inside the Search scope. */
function useAllVisibleReportActions(): VisibleReportActions {
    return useOnyxState(
        (state) =>
            getAllVisibleReportActions(
                state[ONYXKEYS.COLLECTION.REPORT_ACTIONS],
                state[ONYXKEYS.COLLECTION.REPORT],
                state[ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS],
                state[ONYXKEYS.SESSION]?.accountID,
            ),
        {dependencies},
    );
}

export default useAllVisibleReportActions;
