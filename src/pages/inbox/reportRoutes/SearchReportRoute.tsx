import React from 'react';
import RHPLayout from '@components/report/layouts/RHPLayout';
import ReportKindDispatcher from '@components/report/ReportKindDispatcher';
import MissingReportIdRetry from '@components/report/shared/MissingReportIdRetry';
import ReportActionIdValidator from '@components/report/shared/ReportActionIdValidator';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {RightModalNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';

type SearchReportRouteProps = PlatformStackScreenProps<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.SEARCH_REPORT>;

/**
 * Route body for `SCREENS.RIGHT_MODAL.SEARCH_REPORT` (RHP-mounted chat-stream report).
 *
 * Today's `ReportRouteParamHandler` covered this screen as well as `SCREENS.REPORT`,
 * so the same renderless pair (`MissingReportIdRetry` + `ReportActionIdValidator`)
 * mounts here. The dispatcher mounts a real compound for every report kind, so this
 * route body has no `fallthrough` to pass.
 */
function SearchReportRoute({route}: SearchReportRouteProps) {
    const {reportID, reportActionID, backTo} = route.params ?? {};

    return (
        <RHPLayout backTo={backTo}>
            <MissingReportIdRetry hasReportID={!!reportID} />
            <ReportActionIdValidator reportActionID={reportActionID} />
            <ReportKindDispatcher
                reportID={reportID}
                reportActionID={reportActionID}
            />
        </RHPLayout>
    );
}

SearchReportRoute.displayName = 'SearchReportRoute';

export default SearchReportRoute;
