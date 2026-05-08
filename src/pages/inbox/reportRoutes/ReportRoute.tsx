import React from 'react';
import SplitPaneLayout from '@components/report/layouts/SplitPaneLayout';
import ReportKindDispatcher from '@components/report/ReportKindDispatcher';
import MissingReportIdRetry from '@components/report/shared/MissingReportIdRetry';
import ReportActionIdValidator from '@components/report/shared/ReportActionIdValidator';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {ReportsSplitNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';

type ReportRouteProps = PlatformStackScreenProps<ReportsSplitNavigatorParamList, typeof SCREENS.REPORT>;

/**
 * Route body for `SCREENS.REPORT` (split-pane / central pane).
 *
 * Wires the renderless param blocks above the dispatcher: `MissingReportIdRetry`
 * replays `findLastAccessedReport` when the route param is empty, and
 * `ReportActionIdValidator` clears non-numeric `reportActionID` values. Both used to
 * live in `ReportRouteParamHandler`; splitting them keeps each block's responsibility
 * narrow and lets the dispatcher own the kind-detection alone.
 *
 * The dispatcher mounts a real compound for every report kind (Task / TransactionThread
 * / MoneyRequestReport / ChatReport), so this route body has no `fallthrough` to pass.
 */
function ReportRoute({route}: ReportRouteProps) {
    const {reportID, reportActionID, referrer, openOnAdminRoom} = route.params ?? {};

    return (
        <SplitPaneLayout backTo={route.params?.backTo}>
            <MissingReportIdRetry
                openOnAdminRoom={openOnAdminRoom}
                hasReportID={!!reportID}
            />
            <ReportActionIdValidator reportActionID={reportActionID} />
            <ReportKindDispatcher
                reportID={reportID}
                reportActionID={reportActionID}
                referrer={referrer}
            />
        </SplitPaneLayout>
    );
}

ReportRoute.displayName = 'ReportRoute';

export default ReportRoute;
