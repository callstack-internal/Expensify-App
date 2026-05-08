import {useFocusEffect, useRoute} from '@react-navigation/native';
import React from 'react';
import {View} from 'react-native';
import type {ValueOf} from 'type-fest';
import MoneyReportHeaderSelectionDropdown from '@components/MoneyReportHeaderActions/MoneyReportHeaderSelectionDropdown';
import NarrowSelectionToolbar from '@components/MoneyRequestReportView/SelectionToolbar';
import {useSearchActionsContext, useSearchStateContext} from '@components/Search/SearchContext';
import useMobileSelectionMode from '@hooks/useMobileSelectionMode';
import useNetworkWithOfflineStatus from '@hooks/useNetworkWithOfflineStatus';
import useOnyx from '@hooks/useOnyx';
import usePaginatedReportActions from '@hooks/usePaginatedReportActions';
import useReportPrimaryAction from '@hooks/useReportPrimaryAction';
import useReportTransactionsCollection from '@hooks/useReportTransactionsCollection';
import useResponsiveLayoutOnWideRHP from '@hooks/useResponsiveLayoutOnWideRHP';
import useThemeStyles from '@hooks/useThemeStyles';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {getAllNonDeletedTransactions} from '@libs/MoneyRequestReportUtils';
import type {PlatformStackRouteProp} from '@libs/Navigation/PlatformStackNavigation/types';
import type {ReportsSplitNavigatorParamList, RightModalNavigatorParamList} from '@libs/Navigation/types';
import {getFilteredReportActionsForReportView} from '@libs/ReportActionsUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import SCREENS from '@src/SCREENS';

type ReportPrimaryAction = ValueOf<typeof CONST.REPORT.PRIMARY_ACTIONS> | '';

function narrowToReportPrimaryAction(value: ReturnType<typeof useReportPrimaryAction>): ReportPrimaryAction {
    if ((Object.values(CONST.REPORT.PRIMARY_ACTIONS) as string[]).includes(value)) {
        return value as ValueOf<typeof CONST.REPORT.PRIMARY_ACTIONS>;
    }
    return '';
}

type SelectionToolbarProps = {
    /** Identity of the multi-transaction money-request report whose selection this toolbar acts on. */
    reportID: string | undefined;
};

/**
 * Selection toolbar block for `MoneyRequestReport`. Self-subscribes to the
 * tree-wide `SearchContext.selectedTransactionIDs` and returns `null` when
 * nothing is selected, so blocks downstream pay no render cost when the toolbar
 * is dormant.
 *
 * Unifies the two pre-extraction selection UIs into a single sibling block of
 * `Header` / `SettlementBar`:
 *   - Wide layout (`!shouldUseNarrowLayout`): the multi-row dropdown previously
 *     rendered by `MoneyReportHeaderActions` when `hasSelectedTransactions`.
 *   - Narrow layout (`shouldUseNarrowLayout && isMobileSelectionModeEnabled`):
 *     today's `MoneyRequestReportView/SelectionToolbar` UI (checkbox + actions
 *     dropdown).
 *
 * Owns the focus-effect that clears stale selections when the user navigates
 * between money-request reports — previously held by `SelectionToolbarGate` in
 * `MoneyRequestReportView/SelectionToolbar.tsx`.
 *
 * Position note: the wide selection dropdown previously lived inside the header
 * row (replacing the primary/secondary buttons). The compound architecture
 * commits to the sibling-block position only — wide layouts now show the
 * selection toolbar as a row beneath the header, matching the narrow layout.
 */
function SelectionToolbar({reportID}: SelectionToolbarProps) {
    const onyxReportID = getNonEmptyStringOnyxID(reportID);
    const {selectedTransactionIDs, currentSelectedTransactionReportID} = useSearchStateContext();
    const {clearSelectedTransactions, setCurrentSelectedTransactionReportID} = useSearchActionsContext();
    const isMobileSelectionModeEnabled = useMobileSelectionMode();

    // Clear stale selections when this block becomes focused for a different
    // report (carry-over from `SelectionToolbarGate`).
    useFocusEffect(() => {
        if (onyxReportID && currentSelectedTransactionReportID !== onyxReportID && selectedTransactionIDs.length > 0) {
            clearSelectedTransactions(true);
        }

        setCurrentSelectedTransactionReportID(onyxReportID);
    });

    if (selectedTransactionIDs.length === 0 && !isMobileSelectionModeEnabled) {
        return null;
    }

    if (!onyxReportID) {
        return null;
    }

    return (
        <View testID="MoneyRequestReport.SelectionToolbar">
            <SelectionToolbarContent reportID={onyxReportID} />
        </View>
    );
}

type SelectionToolbarContentProps = {
    reportID: string;
};

function SelectionToolbarContent({reportID}: SelectionToolbarContentProps) {
    const styles = useThemeStyles();
    const route = useRoute<
        | PlatformStackRouteProp<ReportsSplitNavigatorParamList, typeof SCREENS.REPORT>
        | PlatformStackRouteProp<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.EXPENSE_REPORT>
        | PlatformStackRouteProp<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.SEARCH_MONEY_REQUEST_REPORT>
        | PlatformStackRouteProp<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.SEARCH_REPORT>
    >();
    const {shouldUseNarrowLayout} = useResponsiveLayoutOnWideRHP();
    const isReportInSearch = route.name === SCREENS.RIGHT_MODAL.SEARCH_REPORT || route.name === SCREENS.RIGHT_MODAL.SEARCH_MONEY_REQUEST_REPORT;

    // Self-subscribe to derive the data each variant needs. The narrow toolbar
    // takes `transactions` + `reportActions` and the focus-effect cleared stale
    // selections at the gate level — mirror the same pipeline today's
    // `MoneyRequestReportActionsList` uses to avoid drift when forwarding props.
    const {isOffline} = useNetworkWithOfflineStatus();
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const {reportActions: unfilteredReportActions} = usePaginatedReportActions(report?.reportID);
    const reportActions = getFilteredReportActionsForReportView(unfilteredReportActions);
    const allReportTransactions = useReportTransactionsCollection(reportID);
    const reportTransactions = getAllNonDeletedTransactions(allReportTransactions, reportActions, isOffline, true);
    const transactions = reportTransactions?.filter((t) => isOffline || t.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE) ?? [];

    const primaryAction = useReportPrimaryAction(reportID);
    const narrowedPrimaryAction = narrowToReportPrimaryAction(primaryAction);

    if (!shouldUseNarrowLayout) {
        return (
            <View style={[styles.dFlex, styles.w100, styles.ph5, styles.pb3]}>
                <MoneyReportHeaderSelectionDropdown
                    reportID={reportID}
                    primaryAction={narrowedPrimaryAction}
                    isReportInSearch={isReportInSearch}
                    wrapperStyle={styles.w100}
                />
            </View>
        );
    }

    return (
        <NarrowSelectionToolbar
            reportID={reportID}
            transactions={transactions}
            reportActions={reportActions}
        />
    );
}

SelectionToolbar.displayName = 'MoneyRequestReport.SelectionToolbar';

export default SelectionToolbar;
