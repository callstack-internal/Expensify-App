import React from 'react';
import RHPLayout from '@components/report/layouts/RHPLayout';
import ReportKindDispatcher from '@components/report/ReportKindDispatcher';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {RightModalNavigatorParamList} from '@libs/Navigation/types';
import SearchMoneyRequestReportPage from '@pages/Search/SearchMoneyRequestReportPage';
import type SCREENS from '@src/SCREENS';

// The route body is registered against both `SEARCH_MONEY_REQUEST_REPORT` and
// `EXPENSE_REPORT`. The navigator passes whichever screen's prop matches the
// registration; we declare the union to mirror today's `SearchMoneyRequestReportPage`
// signature so the registration drop-in is type-stable.
type MoneyRequestReportRouteProps =
    | PlatformStackScreenProps<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.SEARCH_MONEY_REQUEST_REPORT>
    | PlatformStackScreenProps<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.EXPENSE_REPORT>;
type SearchMoneyRequestReportPageProps = React.ComponentProps<typeof SearchMoneyRequestReportPage>;

/**
 * Route body for `SCREENS.RIGHT_MODAL.SEARCH_MONEY_REQUEST_REPORT` and
 * `SCREENS.RIGHT_MODAL.EXPENSE_REPORT` (the two RHP money-request report routes).
 *
 * These routes always carry a `reportID` and never accept `reportActionID`, so the
 * `MissingReportIdRetry` / `ReportActionIdValidator` pair is intentionally absent —
 * mounting them here would be dead code today and would lock us into a contract this
 * screen does not need.
 */
function MoneyRequestReportRoute({route, navigation}: MoneyRequestReportRouteProps) {
    const {reportID, backTo} = route.params ?? {};

    // The navigator passes a screen prop whose `route.name` is one of two literals;
    // each branch of the page's union prop type expects only one of them. The pair is
    // structurally identical for the values the page reads, so we cast at the
    // boundary rather than discriminate on `route.name` and duplicate the call.
    const pageProps = {route, navigation} as unknown as SearchMoneyRequestReportPageProps;

    return (
        <RHPLayout backTo={backTo}>
            <ReportKindDispatcher
                reportID={reportID}
                // eslint-disable-next-line react/jsx-props-no-spreading -- Forward `route`/`navigation` verbatim to the unchanged screen component.
                fallthrough={<SearchMoneyRequestReportPage {...pageProps} />}
            />
        </RHPLayout>
    );
}

MoneyRequestReportRoute.displayName = 'MoneyRequestReportRoute';

export default MoneyRequestReportRoute;
