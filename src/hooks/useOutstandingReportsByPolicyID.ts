import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report} from '@src/types/onyx';

import type {OutstandingReportsByPolicyID} from '@selectors/Report';
import type {OnyxCollection} from 'react-native-onyx';

import {outstandingReportsByPolicyIDSelector} from '@selectors/Report';
// useOnyxState reads the store directly, so Search surfaces get the live reports instead of the snapshot @hooks/useOnyx swaps in
import {useOnyxState} from 'react-native-onyx';

const dependencies = [ONYXKEYS.COLLECTION.REPORT];

function selectOutstandingReportsByPolicyID(reports: unknown): OutstandingReportsByPolicyID {
    // useOnyxState's state view types a collection key as one member, but at runtime it returns the whole collection
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return outstandingReportsByPolicyIDSelector(reports as OnyxCollection<Report>);
}

function useOutstandingReportsByPolicyID(): OutstandingReportsByPolicyID {
    return useOnyxState((state) => selectOutstandingReportsByPolicyID(state[ONYXKEYS.COLLECTION.REPORT]), {dependencies});
}

function useOutstandingReportsForPolicy(policyID: string | undefined): OnyxCollection<Report> {
    return useOnyxState((state) => selectOutstandingReportsByPolicyID(state[ONYXKEYS.COLLECTION.REPORT])[policyID ?? CONST.DEFAULT_NUMBER_ID], {dependencies});
}

export {useOutstandingReportsForPolicy};
export default useOutstandingReportsByPolicyID;
