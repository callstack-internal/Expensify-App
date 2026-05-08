import React from 'react';
import RHPLayout from '@components/report/layouts/RHPLayout';
import ReportKindDispatcher from '@components/report/ReportKindDispatcher';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {RightModalNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';

// The route body is registered against both `SEARCH_MONEY_REQUEST_REPORT` and
// `EXPENSE_REPORT`. The navigator passes whichever screen's prop matches the
// registration; we declare the union so the registration drop-in is type-stable.
type MoneyRequestReportRouteProps =
    | PlatformStackScreenProps<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.SEARCH_MONEY_REQUEST_REPORT>
    | PlatformStackScreenProps<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.EXPENSE_REPORT>;

/**
 * Route body for `SCREENS.RIGHT_MODAL.SEARCH_MONEY_REQUEST_REPORT` and
 * `SCREENS.RIGHT_MODAL.EXPENSE_REPORT` (the two RHP money-request report routes).
 *
 * These routes always carry a `reportID` and never accept `reportActionID`, so the
 * `MissingReportIdRetry` / `ReportActionIdValidator` pair is intentionally absent —
 * mounting them here would be dead code today and would lock us into a contract this
 * screen does not need. The dispatcher mounts a real compound for every report kind,
 * so this route body has no `fallthrough` to pass.
 */
function MoneyRequestReportRoute({route}: MoneyRequestReportRouteProps) {
    const {reportID, backTo} = route.params ?? {};

    return (
        <RHPLayout backTo={backTo}>
            <ReportKindDispatcher reportID={reportID} />
        </RHPLayout>
    );
}

MoneyRequestReportRoute.displayName = 'MoneyRequestReportRoute';

export default MoneyRequestReportRoute;
