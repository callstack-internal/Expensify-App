import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportAttributesSnapshot} from '@src/types/onyx';

import Onyx from 'react-native-onyx';

/** Saves the report attributes, so the next app start can begin from them instead of computing every report. */
function saveReportAttributesSnapshot(snapshot: ReportAttributesSnapshot) {
    // The map is rebuilt by ReportAttributesCache only, so comparing it with the stored one would be wasted work.
    Onyx.set(ONYXKEYS.REPORT_ATTRIBUTES_SNAPSHOT, snapshot, {skipCacheCheck: true});
}

export default saveReportAttributesSnapshot;
