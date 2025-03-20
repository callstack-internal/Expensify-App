import {useMemo} from 'react';
import {useOnyx} from 'react-native-onyx';
import SidebarUtils from '@libs/SidebarUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';

/**
 * Hook to get pinned reports
 */
function usePinnedReports(derivedCurrentReportID?: string) {
    const [priorityMode] = useOnyx(ONYXKEYS.NVP_PRIORITY_MODE, {initialValue: CONST.PRIORITY_MODE.DEFAULT});
    const [betas] = useOnyx(ONYXKEYS.BETAS);
    const [policies] = useOnyx(ONYXKEYS.COLLECTION.POLICY);
    const [transactionViolations] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS);

    return useMemo(() => {
        const time = performance.now();
        const pinnedReports = SidebarUtils.getPinnedReports(derivedCurrentReportID, betas, policies, priorityMode, transactionViolations);
        console.log('[TIME] pinnedReports', performance.now() - time);
        return pinnedReports;
    }, [betas, derivedCurrentReportID, policies, priorityMode, transactionViolations]);
}

export default usePinnedReports;
