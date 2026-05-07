import {useFocusEffect, useNavigation} from '@react-navigation/native';
import useArchivedReportsIdSet from '@hooks/useArchivedReportsIdSet';
import usePermissions from '@hooks/usePermissions';
import Log from '@libs/Log';
import Navigation from '@libs/Navigation/Navigation';
import {findLastAccessedReport} from '@libs/ReportUtils';
import CONST from '@src/CONST';

type MissingReportIdRetryProps = {
    /**
     * Whether the route was opened with the `openOnAdminRoom` intent. Persisted by
     * `ReportsSplitNavigator` when the navigator's first-try `findLastAccessedReport`
     * resolution returned `undefined` because reports were not yet loaded. We replay
     * the same resolution here on focus so the retry uses the same intent.
     */
    openOnAdminRoom?: boolean;

    /**
     * Whether the route currently has a `reportID` route param. When the param is
     * already present this block is a no-op — only the missing-id retry path applies.
     */
    hasReportID: boolean;
};

/**
 * Renderless block. Only acts when `route.params.reportID` is empty. Re-runs
 * `findLastAccessedReport` on focus and writes the resolved id back via
 * `navigation.setParams({reportID})`.
 *
 * This is the "deterministic-replay hint" half of the former `ReportRouteParamHandler`:
 * the navigator already attempted the same resolution once on init; if reports were not
 * yet loaded at that moment the param is empty and we replay the resolution here.
 */
function MissingReportIdRetry({openOnAdminRoom, hasReportID}: MissingReportIdRetryProps) {
    const navigation = useNavigation();
    const {isBetaEnabled} = usePermissions();
    const archivedReportsIdSet = useArchivedReportsIdSet();

    useFocusEffect(() => {
        // Don't update if there is a reportID in the params already
        if (hasReportID) {
            return;
        }

        const lastAccessedReportID = findLastAccessedReport(!isBetaEnabled(CONST.BETAS.DEFAULT_ROOMS), !!openOnAdminRoom, undefined, archivedReportsIdSet)?.reportID;

        // It's possible that reports aren't fully loaded yet
        // in that case the reportID is undefined
        if (!lastAccessedReportID) {
            return;
        }
        Navigation.isNavigationReady().then(() => {
            Log.info(`[ReportScreen] no reportID found in params, setting it to lastAccessedReportID: ${lastAccessedReportID}`);
            navigation.setParams({reportID: lastAccessedReportID});
        });
    });

    return null;
}

MissingReportIdRetry.displayName = 'MissingReportIdRetry';

export default MissingReportIdRetry;
