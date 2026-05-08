// ChatReport compound. The dispatcher mounts the default export below (the
// compound shell) directly, and tests / future slices import named blocks via
// `ChatReport.Header`, `ChatReport.HeaderSkeleton`, `ChatReport.Actions`,
// `ChatReport.Composer`, `ChatReport.AccountManagerBanner`.
//
// This shell mounts the named blocks (`Header`, `AccountManagerBanner`, `Actions`,
// `Composer`) as the visible UI for every chat-style report — DM, group chat,
// self-DM (when not a track-expense thread), policy admin / announce / user-created
// rooms, policy expense chat, concierge, and chat threads on chat parents. It is
// the dispatcher's default branch — the kinds Task / TransactionThread / MoneyRequest
// don't claim.
//
// Provider plumbing rationale: today's `ReportScreen` wraps its visible blocks in a
// chain of providers (`ActionListContext`, `ReportDragAndDropProvider`,
// `AgentZeroStatusProvider`, `ConciergeDraftProvider`) and renderless lifecycle
// handlers (`ReportFetchHandler`, `ReportLifecycleHandler`,
// `ReportNavigateAwayHandler`, etc.). The composer (`ReportActionCompose`) and
// actions list (`ReportActionsList`) read from these contexts at runtime — none of
// them can be cleanly localized to a single block in this slice without a much
// bigger refactor. We mount them in the shell instead. Subsequent slices will push
// each provider down into the narrowest block that needs it.
//
// Differences from `TransactionThread`'s shell:
//   - No `useShowWideRHPVersion(true)` — chat reports render at default RHP width.
//   - `useSubmitToDestinationVisible` is mounted here (chat-only telemetry that
//     today's `ReportScreen` runs for every report; the transaction-thread shell
//     doesn't run it because money-request reports use a different flow).
//   - `AccountManagerBanner` block is always mounted between header and body. It
//     self-decides whether to render the concierge banner content or null based on
//     today's `isConciergeChatReport` check inside the leaf.
import {PortalHost} from '@gorhom/portal';
import {useNavigation, useRoute} from '@react-navigation/native';
import React from 'react';
import type {ViewStyle} from 'react-native';
import {View} from 'react-native';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import BootstrapFetcher from '@components/report/shared/BootstrapFetcher';
import ScreenWrapper from '@components/ScreenWrapper';
import WideRHPOverlayWrapper from '@components/WideRHPOverlayWrapper';
import useActionListContextValue from '@hooks/useActionListContextValue';
import {useCurrentReportIDState} from '@hooks/useCurrentReportID';
import useOnyx from '@hooks/useOnyx';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useSubmitToDestinationVisible from '@hooks/useSubmitToDestinationVisible';
import useThemeStyles from '@hooks/useThemeStyles';
import useViewportOffsetTop from '@hooks/useViewportOffsetTop';
import {removeFailedReport} from '@libs/actions/Report';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackNavigationProp, PlatformStackRouteProp} from '@libs/Navigation/PlatformStackNavigation/types';
import type {ReportsSplitNavigatorParamList, RightModalNavigatorParamList} from '@libs/Navigation/types';
import {AgentZeroStatusProvider} from '@pages/inbox/AgentZeroStatusContext';
import {ConciergeDraftProvider} from '@pages/inbox/ConciergeDraftContext';
import DeleteTransactionNavigateBackHandler from '@pages/inbox/DeleteTransactionNavigateBackHandler';
import useDeferNonEssentials from '@pages/inbox/hooks/useDeferNonEssentials';
import useFlushDeferredWriteOnFocus from '@pages/inbox/hooks/useFlushDeferredWriteOnFocus';
import LinkedActionNotFoundGuard from '@pages/inbox/LinkedActionNotFoundGuard';
import ReactionListWrapper from '@pages/inbox/ReactionListWrapper';
import ReportDragAndDropProvider from '@pages/inbox/ReportDragAndDropProvider';
import ReportFetchHandler from '@pages/inbox/ReportFetchHandler';
import ReportLifecycleHandler from '@pages/inbox/ReportLifecycleHandler';
import ReportNavigateAwayHandler from '@pages/inbox/ReportNavigateAwayHandler';
import ReportNotFoundGuard from '@pages/inbox/ReportNotFoundGuard';
import {ActionListContext} from '@pages/inbox/ReportScreenContext';
import WideRHPReceiptPanel from '@pages/inbox/WideRHPReceiptPanel';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Route} from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import AccountManagerBanner from './AccountManagerBanner';
import Actions from './Actions';
import Composer from './Composer';
import Header from './Header';
import HeaderSkeleton from './Header/HeaderSkeleton';
import ReplyContextProvider from './ReplyContextProvider';

type ChatReportProps = {
    /** Identity of the chat-style report being rendered. */
    reportID: string | undefined;

    /** Optional linked-action id (chat-stream routes only). Forwarded to `Actions` only. */
    reportActionID?: string;

    /**
     * Optional analytics tag describing how the user reached this report. Reserved
     * for telemetry blocks added in follow-up slices; today the value is held on the
     * shell's prop contract for parity with the dispatcher and forward-compat.
     */
    referrer?: string;
};

// Both `SCREENS.REPORT` (chat-stream) and `SCREENS.RIGHT_MODAL.SEARCH_REPORT` (RHP)
// can host a chat-style report; we type the route as the union so the
// `route.name === SCREENS.RIGHT_MODAL.SEARCH_REPORT` check below is valid in both
// hosts. `ScreenWrapper` itself accepts both navigation shapes.
type ChatReportRoute =
    | PlatformStackRouteProp<ReportsSplitNavigatorParamList, typeof SCREENS.REPORT>
    | PlatformStackRouteProp<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.SEARCH_REPORT>;
type ChatReportNavigation =
    | PlatformStackNavigationProp<ReportsSplitNavigatorParamList, typeof SCREENS.REPORT>
    | PlatformStackNavigationProp<RightModalNavigatorParamList, typeof SCREENS.RIGHT_MODAL.SEARCH_REPORT>;

// `referrer` is reserved for follow-up telemetry wiring; documented on the prop type
// for forward-compat. See block comment on `ChatReportProps`.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- See block comment above.
function ChatReport({reportID, reportActionID, referrer}: ChatReportProps) {
    const styles = useThemeStyles();
    const onyxReportID = getNonEmptyStringOnyxID(reportID);

    // The compound shell sits at the screen-equivalent boundary, so reading
    // `route` / `navigation` here is allowed (and is the only way to compose
    // `ScreenWrapper` and `WideRHPOverlayWrapper` with the right keys/conditions).
    // The named compound blocks below NEVER call `useRoute()` — they take ids as props.
    const route = useRoute<ChatReportRoute>();
    const navigation = useNavigation<ChatReportNavigation>();
    const routeParams = route.params as {backTo?: string} | undefined;
    const backTo = routeParams?.backTo;

    const {isInNarrowPaneModal} = useResponsiveLayout();
    const {currentReportID: currentReportIDValue} = useCurrentReportIDState();
    const viewportOffsetTop = useViewportOffsetTop();
    const isTopMostReportId = currentReportIDValue === onyxReportID;
    const screenWrapperStyle: ViewStyle[] = [styles.appContent, styles.flex1, {marginTop: viewportOffsetTop}];

    const shouldDeferNonEssentials = useDeferNonEssentials(onyxReportID);

    // Chat-only: today's `ReportScreen` runs this for every report it renders. Mirrored
    // here to preserve the visible behavior for chat-style reports.
    useSubmitToDestinationVisible(
        [CONST.TELEMETRY.SUBMIT_FOLLOW_UP_ACTION.DISMISS_MODAL_AND_OPEN_REPORT, CONST.TELEMETRY.SUBMIT_FOLLOW_UP_ACTION.DISMISS_MODAL_ONLY],
        onyxReportID,
        CONST.TELEMETRY.SUBMIT_TO_DESTINATION_VISIBLE_TRIGGER.FOCUS,
    );

    useFlushDeferredWriteOnFocus(CONST.DEFERRED_LAYOUT_WRITE_KEYS.DISMISS_MODAL);

    const actionListValue = useActionListContextValue();

    const [reportPendingActionAndErrors] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${onyxReportID}`, {
        selector: (r) => ({
            reportPendingAction: r?.pendingFields?.addWorkspaceRoom ?? r?.pendingFields?.createChat ?? r?.pendingFields?.createReport ?? r?.pendingFields?.reportName,
            reportErrors: r?.errorFields?.addWorkspaceRoom ?? r?.errorFields?.createChat ?? r?.errorFields?.createReport,
        }),
    });
    const {reportPendingAction, reportErrors} = reportPendingActionAndErrors ?? {};

    const dismissReportCreationError = () => {
        Navigation.goBack(undefined, {
            afterTransition: () => removeFailedReport(onyxReportID),
        });
    };

    // Back-button handler — mirrors today's `ReportHeader` logic so the visible
    // behavior is unchanged. Lives on the shell because the named `Header` block
    // is `useRoute`-free (it takes the function as a prop).
    const onBackButtonPress = (prioritizeBackTo = false) => {
        if (backTo === SCREENS.RIGHT_MODAL.SEARCH_REPORT) {
            Navigation.goBack();
            return;
        }
        if (prioritizeBackTo && backTo) {
            Navigation.goBack(backTo as Route);
            return;
        }
        if (isInNarrowPaneModal) {
            Navigation.goBack();
            return;
        }
        if (backTo) {
            Navigation.goBack(backTo as Route);
            return;
        }
        Navigation.goBack();
    };

    return (
        <WideRHPOverlayWrapper shouldWrap={route.name === SCREENS.RIGHT_MODAL.SEARCH_REPORT}>
            <ActionListContext.Provider value={actionListValue}>
                <ReactionListWrapper>
                    <ScreenWrapper
                        navigation={navigation}
                        style={screenWrapperStyle}
                        shouldEnableKeyboardAvoidingView={isTopMostReportId || isInNarrowPaneModal}
                        testID={`chat-report-${onyxReportID}`}
                    >
                        <BootstrapFetcher reportID={onyxReportID} />
                        {!shouldDeferNonEssentials && (
                            <>
                                <DeleteTransactionNavigateBackHandler />
                                <ReportFetchHandler />
                                <ReportNavigateAwayHandler />
                            </>
                        )}
                        <ReportNotFoundGuard>
                            <LinkedActionNotFoundGuard>
                                <ReportDragAndDropProvider>
                                    {!shouldDeferNonEssentials && <ReportLifecycleHandler reportID={onyxReportID} />}
                                    <ReplyContextProvider>
                                        <Header
                                            reportID={onyxReportID}
                                            onBackButtonPress={onBackButtonPress}
                                        />
                                        {!shouldDeferNonEssentials && <AccountManagerBanner reportID={onyxReportID} />}
                                        <OfflineWithFeedback
                                            pendingAction={reportPendingAction}
                                            errors={reportErrors}
                                            shouldShowErrorMessages={false}
                                            onClose={dismissReportCreationError}
                                            needsOffscreenAlphaCompositing
                                            style={styles.flex1}
                                            contentContainerStyle={styles.flex1}
                                            errorRowStyles={[styles.ph5, styles.mv2]}
                                        >
                                            <View style={[styles.flex1, styles.flexRow]}>
                                                {!shouldDeferNonEssentials && <WideRHPReceiptPanel />}
                                                <AgentZeroStatusProvider reportID={onyxReportID}>
                                                    <ConciergeDraftProvider reportID={onyxReportID}>
                                                        <View
                                                            style={[styles.flex1, styles.justifyContentEnd, styles.overflowHidden]}
                                                            testID="report-actions-view-wrapper"
                                                        >
                                                            <Actions
                                                                reportID={onyxReportID}
                                                                reportActionID={reportActionID}
                                                            />
                                                            <Composer reportID={onyxReportID} />
                                                        </View>
                                                    </ConciergeDraftProvider>
                                                </AgentZeroStatusProvider>
                                            </View>
                                        </OfflineWithFeedback>
                                    </ReplyContextProvider>
                                    <PortalHost name="suggestions" />
                                </ReportDragAndDropProvider>
                            </LinkedActionNotFoundGuard>
                        </ReportNotFoundGuard>
                    </ScreenWrapper>
                </ReactionListWrapper>
            </ActionListContext.Provider>
        </WideRHPOverlayWrapper>
    );
}

ChatReport.displayName = 'ChatReport';

ChatReport.Header = Header;
ChatReport.HeaderSkeleton = HeaderSkeleton;
ChatReport.Actions = Actions;
ChatReport.Composer = Composer;
ChatReport.AccountManagerBanner = AccountManagerBanner;

export default ChatReport;
