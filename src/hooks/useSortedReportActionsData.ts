import {getIsOffline} from '@libs/NetworkState';

import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, ReportActions} from '@src/types/onyx';

import type {SortedReportActionsData} from '@selectors/SortedReportActions';
import type {OnyxCollection} from 'react-native-onyx';

import {getSortedReportActionsData} from '@selectors/SortedReportActions';
// useOnyxState reads the store directly, so Search surfaces get the live report actions instead of the snapshot @hooks/useOnyx swaps in
import {useOnyxState} from 'react-native-onyx';

// NETWORK is a dependency only so the selector reruns when the offline state that getIsOffline() returns changes
const dependencies = [ONYXKEYS.COLLECTION.REPORT_ACTIONS, ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.NETWORK];

function useSortedReportActionsData(): SortedReportActionsData {
    return useOnyxState(
        (state) => {
            // useOnyxState's state view types a collection key as one member, but at runtime it returns the whole collection
            /* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
            const allReportActions = state[ONYXKEYS.COLLECTION.REPORT_ACTIONS] as OnyxCollection<ReportActions>;
            const allReports = state[ONYXKEYS.COLLECTION.REPORT] as OnyxCollection<Report>;
            /* eslint-enable @typescript-eslint/no-unsafe-type-assertion */
            return getSortedReportActionsData(allReportActions, allReports, getIsOffline());
        },
        {dependencies},
    );
}

export default useSortedReportActionsData;
