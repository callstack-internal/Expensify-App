// MoneyRequestReport compound. The dispatcher mounts the default export below (the
// compound shell) directly, and tests / future slices import named blocks via
// `MoneyRequestReport.Header`, `MoneyRequestReport.HeaderSkeleton`,
// `MoneyRequestReport.Table`, `MoneyRequestReport.ReceiptPanel`,
// `MoneyRequestReport.ReceiptPanelSkeleton`, `MoneyRequestReport.SettlementBar`,
// `MoneyRequestReport.SelectionToolbar`.
//
// This shell mounts the named blocks (`Header`, `Table`, `ReceiptPanel`,
// `SettlementBar`, `SelectionToolbar`) as the visible UI for multi-transaction
// money-request reports (IOU / expense / invoice with `transactionCount > 1`).
// Single-tx and zero-tx money-request reports are served by the `TransactionThread`
// compound — this shell is mounted only when the dispatcher has determined the
// table-view is the correct rendering.
//
// Provider plumbing rationale: today's `SearchMoneyRequestReportPage` wraps its
// visible content in `WideRHPOverlayWrapper` + `ActionListContext` +
// `ReactionListWrapper` + `ScreenWrapper` + `DragAndDropProvider`. The wrapped
// `MoneyRequestReportActionsList` (which `Table` mounts) reads `ActionListContext`
// at runtime and resolves both `reportID` and `reportActionID` from `useRoute()`
// itself; today's behavior depends on those providers being present at this level.
// We mount them in the shell so the visible behavior is unchanged. A follow-up
// slice pushes each provider down into the narrowest block that needs it.
//
// Differences from `TransactionThread`'s shell:
//   - `useShowSuperWideRHPVersion(true)` instead of `useShowWideRHPVersion(true)` —
//     multi-transaction money-request reports register at super-wide RHP width.
//   - `WideRHPOverlayWrapper` is unconditional. The compound is mounted only by
//     the two RHP routes (`SEARCH_MONEY_REQUEST_REPORT`, `EXPENSE_REPORT`) — no
//     central-pane host exists for multi-tx money-request reports today, so the
//     `WideRHPOverlayWrapper.shouldWrap` toggle is unnecessary.
//   - `DragAndDropProvider` (the `@components/DragAndDrop/Provider` one used by
//     `SearchMoneyRequestReportPage`) instead of `ReportDragAndDropProvider` —
//     today's money-request page uses this one; preserve it verbatim.
//   - `ReceiptContextProvider` instead of `ReplyContextProvider`.
//   - No `Composer` block; multi-tx money-request reports have no composer today.
import {PortalHost} from '@gorhom/portal';
import {useNavigation, useRoute} from '@react-navigation/native';
import React from 'react';
import {View} from 'react-native';
import DragAndDropProvider from '@components/DragAndDrop/Provider';
import BootstrapFetcher from '@components/report/shared/BootstrapFetcher';
import ScreenWrapper from '@components/ScreenWrapper';
import useShowSuperWideRHPVersion from '@components/WideRHPContextProvider/useShowSuperWideRHPVersion';
import WideRHPOverlayWrapper from '@components/WideRHPOverlayWrapper';
import useActionListContextValue from '@hooks/useActionListContextValue';
import useThemeStyles from '@hooks/useThemeStyles';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackNavigationProp, PlatformStackRouteProp} from '@libs/Navigation/PlatformStackNavigation/types';
import type {RightModalNavigatorParamList} from '@libs/Navigation/types';
import ReactionListWrapper from '@pages/inbox/ReactionListWrapper';
import {ActionListContext} from '@pages/inbox/ReportScreenContext';
import type {Route} from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import Header from './Header';
import HeaderSkeleton from './Header/HeaderSkeleton';
import ReceiptContextProvider from './ReceiptContextProvider';
import ReceiptPanel from './ReceiptPanel';
import ReceiptPanelSkeleton from './ReceiptPanel/ReceiptPanelSkeleton';
import SelectionToolbar from './SelectionToolbar';
import SettlementBar from './SettlementBar';
import Table from './Table';

type MoneyRequestReportProps = {
    /** Identity of the multi-transaction money-request report being rendered. */
    reportID: string | undefined;

    /**
     * Optional analytics tag describing how the user reached this report. Reserved
     * for telemetry blocks added in follow-up slices; today the value is held on the
     * shell's prop contract for parity with the dispatcher and forward-compat.
     */
    referrer?: string;
};

// The compound is mounted only by the two RHP money-request routes; both share the
// same param shape for the values the shell reads. We type the union so the shell
// can pull `backTo` regardless of which specific screen invoked it.
type MoneyRequestReportRoute =
    | PlatformStackRouteProp<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.SEARCH_MONEY_REQUEST_REPORT>
    | PlatformStackRouteProp<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.EXPENSE_REPORT>;
type MoneyRequestReportNavigation =
    | PlatformStackNavigationProp<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.SEARCH_MONEY_REQUEST_REPORT>
    | PlatformStackNavigationProp<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.EXPENSE_REPORT>;

// `referrer` is reserved for follow-up telemetry wiring; documented on the prop type
// for forward-compat. See block comment on `MoneyRequestReportProps`.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- See block comment above.
function MoneyRequestReport({reportID, referrer}: MoneyRequestReportProps) {
    const styles = useThemeStyles();
    const onyxReportID = getNonEmptyStringOnyxID(reportID);

    // The compound shell sits at the screen-equivalent boundary, so reading
    // `route` / `navigation` here is allowed (and is the only way to compose
    // `ScreenWrapper` and resolve `backTo`). The named compound blocks below
    // NEVER call `useRoute()` — they take ids as props.
    const route = useRoute<MoneyRequestReportRoute>();
    const navigation = useNavigation<MoneyRequestReportNavigation>();
    const routeParams = route.params as {backTo?: string} | undefined;
    const backTo = routeParams?.backTo;

    const actionListValue = useActionListContextValue();

    // Multi-transaction money-request reports always register super-wide RHP width.
    // The hook is route-driven internally (and a no-op on native), so calling it
    // with `true` here registers the super-wide layout for the host RHP route.
    useShowSuperWideRHPVersion(true);

    // Back-button handler resolved at the shell so the named `Header` block can stay
    // `useRoute`-free. Mirrors today's `MoneyRequestReportView.goBackFromSearchMoneyRequest`
    // posture: prefer `backTo` when present, otherwise fall through to the navigator's
    // own back behavior.
    const onBackButtonPress = () => {
        if (backTo) {
            Navigation.goBack(backTo as Route);
            return;
        }
        Navigation.goBack();
    };

    return (
        <WideRHPOverlayWrapper>
            <ActionListContext.Provider value={actionListValue}>
                <ReactionListWrapper>
                    <ScreenWrapper
                        navigation={navigation}
                        testID={`money-request-report-${onyxReportID}`}
                        shouldEnableMaxHeight
                        offlineIndicatorStyle={styles.mtAuto}
                    >
                        <BootstrapFetcher reportID={onyxReportID} />
                        <DragAndDropProvider>
                            <ReceiptContextProvider>
                                <Header
                                    reportID={onyxReportID}
                                    onBackButtonPress={onBackButtonPress}
                                />
                                <SelectionToolbar reportID={onyxReportID} />
                                <SettlementBar reportID={onyxReportID} />
                                <View style={[styles.flex1, styles.flexRow]}>
                                    <View style={[styles.overflowHidden, styles.justifyContentEnd, styles.flex1]}>
                                        <Table reportID={onyxReportID} />
                                    </View>
                                    <ReceiptPanel reportID={onyxReportID} />
                                </View>
                                <PortalHost name="suggestions" />
                            </ReceiptContextProvider>
                        </DragAndDropProvider>
                    </ScreenWrapper>
                </ReactionListWrapper>
            </ActionListContext.Provider>
        </WideRHPOverlayWrapper>
    );
}

MoneyRequestReport.displayName = 'MoneyRequestReport';

MoneyRequestReport.Header = Header;
MoneyRequestReport.HeaderSkeleton = HeaderSkeleton;
MoneyRequestReport.Table = Table;
MoneyRequestReport.ReceiptPanel = ReceiptPanel;
MoneyRequestReport.ReceiptPanelSkeleton = ReceiptPanelSkeleton;
MoneyRequestReport.SettlementBar = SettlementBar;
MoneyRequestReport.SelectionToolbar = SelectionToolbar;

export default MoneyRequestReport;
