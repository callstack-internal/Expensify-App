import {useRoute} from '@react-navigation/native';
import React from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import MoneyReportHeaderActions from '@components/MoneyReportHeaderActions';
import {useSearchStateContext} from '@components/Search/SearchContext';
import useOnyx from '@hooks/useOnyx';
import useReportPrimaryAction from '@hooks/useReportPrimaryAction';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import type {PlatformStackRouteProp} from '@libs/Navigation/PlatformStackNavigation/types';
import type {ReportsSplitNavigatorParamList, RightModalNavigatorParamList} from '@libs/Navigation/types';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Route} from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import type * as OnyxTypes from '@src/types/onyx';

type SettlementBarProps = {
    /** Identity of the multi-transaction money-request report this bar acts on. */
    reportID: string | undefined;
};

// Existence-only selector — we only need to know whether the report record is loaded.
// Avoids re-rendering on every unrelated mutation of the report record.
const reportExistsSelector = (r: OnyxEntry<OnyxTypes.Report>): boolean => !!r;

/**
 * Settle / approve / pay action bar for `MoneyRequestReport`. Owns the primary
 * action computation (`useReportPrimaryAction`) and renders the report-level
 * action buttons. Self-subscribes via `reportID` so it does not re-render with
 * the rest of the header on unrelated state changes.
 *
 * Position note: today's `MoneyReportHeader` rendered this row in two spots —
 * inline inside the `HeaderWithBackButton` row on wide layouts and below the
 * header on narrow ones. The compound architecture commits to the second
 * position only (sibling block below `Header`), so wide layouts now show the
 * action bar as a row beneath the header instead of beside the title.
 */
function SettlementBar({reportID}: SettlementBarProps) {
    const onyxReportID = getNonEmptyStringOnyxID(reportID);
    const [reportExists] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${onyxReportID}`, {selector: reportExistsSelector});
    const {selectedTransactionIDs} = useSearchStateContext();

    // When selection is active the action area is owned by `SelectionToolbar`
    // (it renders the wide selection dropdown / narrow toolbar). Suppress here so
    // the report-level primary/secondary buttons do not overlap the selection UI.
    if (!onyxReportID || !reportExists || selectedTransactionIDs.length > 0) {
        return null;
    }

    return <SettlementBarContent reportID={onyxReportID} />;
}

type SettlementBarContentProps = {
    reportID: string;
};

// Inner content runs only when the report is loaded. Reading `useRoute()` here is
// allowed because the compound shell already mounts this block under the same RHP
// hosts; the named blocks above this contract still stay `useRoute`-free.
function SettlementBarContent({reportID}: SettlementBarContentProps) {
    const route = useRoute<
        | PlatformStackRouteProp<ReportsSplitNavigatorParamList, typeof SCREENS.REPORT>
        | PlatformStackRouteProp<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.EXPENSE_REPORT>
        | PlatformStackRouteProp<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.SEARCH_MONEY_REQUEST_REPORT>
        | PlatformStackRouteProp<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.SEARCH_REPORT>
    >();
    const isReportInSearch = route.name === SCREENS.RIGHT_MODAL.SEARCH_REPORT || route.name === SCREENS.RIGHT_MODAL.SEARCH_MONEY_REQUEST_REPORT;
    const backTo = (route.params as {backTo?: Route} | undefined)?.backTo;

    const primaryAction = useReportPrimaryAction(reportID);

    return (
        <MoneyReportHeaderActions
            reportID={reportID}
            primaryAction={primaryAction}
            isReportInSearch={isReportInSearch}
            backTo={backTo}
        />
    );
}

SettlementBar.displayName = 'MoneyRequestReport.SettlementBar';

export default SettlementBar;
