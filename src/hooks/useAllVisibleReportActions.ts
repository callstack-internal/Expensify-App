import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportActions, VisibleReportActions} from '@src/types/onyx';

import type {OnyxCollection} from 'react-native-onyx';

import {getAllVisibleReportActions} from '@selectors/VisibleReportActions';
import {useOnyxState} from 'react-native-onyx';

const dependencies = [ONYXKEYS.COLLECTION.REPORT_ACTIONS, ONYXKEYS.SESSION];

/** The cached visibility of every report's actions, keyed by reportID. Reads live data, also inside the Search scope. */
function useAllVisibleReportActions(): VisibleReportActions {
    return useOnyxState(
        (state) => {
            // useOnyxState's state view types a collection key as one member, but at runtime it returns the whole collection
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            const allReportActions = state[ONYXKEYS.COLLECTION.REPORT_ACTIONS] as OnyxCollection<ReportActions>;
            return getAllVisibleReportActions(allReportActions, state[ONYXKEYS.SESSION]?.accountID);
        },
        {dependencies},
    );
}

export default useAllVisibleReportActions;
