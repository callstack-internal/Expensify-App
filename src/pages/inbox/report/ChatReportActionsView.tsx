import {useRoute} from '@react-navigation/native';
import React, {useEffect, useRef, useState} from 'react';
import type {LayoutChangeEvent} from 'react-native';
import ReportActionsSkeletonView from '@components/ReportActionsSkeletonView';
import useConciergeSidePanelReportActions from '@hooks/useConciergeSidePanelReportActions';
import useCopySelectionHelper from '@hooks/useCopySelectionHelper';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useIsInSidePanel from '@hooks/useIsInSidePanel';
import useLoadReportActions from '@hooks/useLoadReportActions';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import usePaginatedReportActions from '@hooks/usePaginatedReportActions';
import useParentReportAction from '@hooks/useParentReportAction';
import usePendingConciergeResponse from '@hooks/usePendingConciergeResponse';
import useReportIsArchived from '@hooks/useReportIsArchived';
import useSidePanelState from '@hooks/useSidePanelState';
import {updateLoadingInitialReportAction} from '@libs/actions/Report';
import DateUtils from '@libs/DateUtils';
import type {PlatformStackRouteProp} from '@libs/Navigation/PlatformStackNavigation/types';
import type {ReportsSplitNavigatorParamList} from '@libs/Navigation/types';
import {generateNewRandomInt} from '@libs/NumberUtils';
import {getFilteredReportActionsForReportView, isCreatedAction, isDeletedParentAction, isIOUActionMatchingTransactionList, isReportActionVisible} from '@libs/ReportActionsUtils';
import {buildOptimisticCreatedReportAction, canUserPerformWriteAction, isConciergeChatReport} from '@libs/ReportUtils';
import markOpenReportEnd from '@libs/telemetry/markOpenReportEnd';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';
import type * as OnyxTypes from '@src/types/onyx';
import isLoadingOnyxValue from '@src/types/utils/isLoadingOnyxValue';
import ReportActionsList from './ReportActionsList';
import UserTypingEventListener from './UserTypingEventListener';

// Chat reports never have a transaction-thread to merge with, so there are no IOU
// transactions to filter against. Hardcoding an empty list keeps the visibility
// filter byte-identical with the previous shared `ReportActionsView`, which read
// this list from a derived value that returned an empty object for chat reportIDs.
const CHAT_REPORT_TRANSACTION_IDS: string[] = [];

type ChatReportActionsViewProps = {
    /** The ID of the chat / concierge report to display actions for */
    reportID: string | undefined;

    /** Callback executed on layout */
    onLayout?: (event: LayoutChangeEvent) => void;
};

function ChatReportActionsView({reportID, onLayout}: ChatReportActionsViewProps) {
    useCopySelectionHelper();
    const {translate} = useLocalize();
    usePendingConciergeResponse(reportID);
    const route = useRoute<PlatformStackRouteProp<ReportsSplitNavigatorParamList, typeof SCREENS.REPORT>>();
    const {accountID: currentUserAccountID} = useCurrentUserPersonalDetails();
    const {isOffline} = useNetwork();
    const reportActionID = route?.params?.reportActionID;
    const didLayout = useRef(false);

    const [report, reportResult] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const [reportMetadata] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_METADATA}${reportID}`);
    const [conciergeReportID] = useOnyx(ONYXKEYS.CONCIERGE_REPORT_ID);
    const [isLoadingApp] = useOnyx(ONYXKEYS.IS_LOADING_APP);
    const [visibleReportActionsData] = useOnyx(ONYXKEYS.DERIVED.VISIBLE_REPORT_ACTIONS);

    const {reportActions: unfilteredReportActions, hasNewerActions, hasOlderActions} = usePaginatedReportActions(reportID, reportActionID);
    const allReportActions = getFilteredReportActionsForReportView(unfilteredReportActions);

    const parentReportAction = useParentReportAction(report);
    const isReportArchived = useReportIsArchived(reportID);
    const canPerformWriteAction = canUserPerformWriteAction(report, isReportArchived);

    const isInSidePanel = useIsInSidePanel();
    const isConciergeSidePanel = isInSidePanel && isConciergeChatReport(report, conciergeReportID);
    const {sessionStartTime} = useSidePanelState();

    const hasUserSentMessage =
        isConciergeSidePanel && !!sessionStartTime
            ? allReportActions.some((action) => !isCreatedAction(action) && action.actorAccountID === currentUserAccountID && action.created >= sessionStartTime)
            : false;

    useEffect(() => {
        // When we linked to message - we do not need to wait for initial actions - they already exist
        if (!reportActionID || !isOffline) {
            return;
        }
        updateLoadingInitialReportAction(report?.reportID ?? reportID);
    }, [isOffline, report?.reportID, reportID, reportActionID]);

    // Regenerate the list ID when the user enters or leaves the comment-linking flow so the
    // FlatList remounts and resolves to the correct scroll position.
    const [listID, setListID] = useState<number>(() => Math.round(Math.random() * 100));
    const [trackedReportActionID, setTrackedReportActionID] = useState<string | undefined>(reportActionID);
    if (trackedReportActionID !== reportActionID) {
        setTrackedReportActionID(reportActionID);
        setListID(generateNewRandomInt(listID, 1, Number.MAX_SAFE_INTEGER));
    }

    const isLoadingInitialReportActions = reportMetadata?.isLoadingInitialReportActions;
    const hasOnceLoadedReportActions = reportMetadata?.hasOnceLoadedReportActions;
    const lastAction = allReportActions?.at(-1);

    // After the MR-parent / TT-leaf / table splits, the only remaining clause of the
    // original `shouldAddCreatedAction` union that applies to chats is the concierge branch.
    const hasCreatedActionAdded = !isCreatedAction(lastAction) && isConciergeSidePanel;

    let reportActions: OnyxTypes.ReportAction[] = allReportActions ?? [];
    if (hasCreatedActionAdded) {
        const createdTime = lastAction?.created && DateUtils.subtractMillisecondsFromDateTime(lastAction.created, 1);
        const optimisticCreatedAction = buildOptimisticCreatedReportAction(String(report?.ownerAccountID), createdTime);
        optimisticCreatedAction.pendingAction = null;
        reportActions = [...reportActions, optimisticCreatedAction];
    }

    const visibleReportActions = reportActions.filter((reportAction) => {
        const passesOfflineCheck = isOffline || isDeletedParentAction(reportAction) || reportAction.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE || reportAction.errors;
        if (!passesOfflineCheck) {
            return false;
        }
        const actionReportID = reportAction.reportID ?? reportID;
        if (!isReportActionVisible(reportAction, actionReportID, canPerformWriteAction, visibleReportActionsData)) {
            return false;
        }
        if (!isIOUActionMatchingTransactionList(reportAction, CHAT_REPORT_TRANSACTION_IDS)) {
            return false;
        }
        return true;
    });

    const allReportActionIDs = (allReportActions ?? []).map((action) => action.reportActionID);

    const {loadOlderChats, loadNewerChats} = useLoadReportActions({
        reportID,
        reportActions,
        allReportActionIDs,
        transactionThreadReport: undefined,
        hasOlderActions,
        hasNewerActions,
    });

    const {
        filteredVisibleActions: conciergeSidePanelFilteredVisibleActions,
        filteredReportActions: conciergeSidePanelFilteredReportActions,
        showConciergeSidePanelWelcome,
        showFullHistory,
        hasPreviousMessages,
        handleShowPreviousMessages,
    } = useConciergeSidePanelReportActions({
        report,
        reportActions,
        visibleReportActions,
        isConciergeSidePanel,
        hasUserSentMessage,
        hasOlderActions,
        sessionStartTime,
        currentUserAccountID,
        greetingText: translate('common.concierge.sidePanelGreeting'),
        loadOlderChats,
    });

    const isMissingReportActions = visibleReportActions.length === 0;
    const shouldShowSkeletonForInitialLoad = !!isLoadingInitialReportActions && isMissingReportActions && !isOffline;
    const shouldShowSkeletonForAppLoad = !!isLoadingApp && !isOffline;
    // Show skeleton for the Concierge side panel until report data has been loaded at least once.
    // Before the first openReport response, hasOlderActions is unreliable, so we can't determine
    // whether to show the greeting or onboarding messages. The skeleton avoids flashing wrong content.
    const shouldShowSkeletonForConciergePanel = isConciergeSidePanel && !hasOnceLoadedReportActions && !isOffline;
    const shouldShowSkeleton = shouldShowSkeletonForConciergePanel || shouldShowSkeletonForInitialLoad || shouldShowSkeletonForAppLoad;
    const hasDerivedValueTimingIssue = reportActions.length > 0 && isMissingReportActions;

    useEffect(() => {
        if (!shouldShowSkeleton || !report) {
            return;
        }
        markOpenReportEnd(report, {warm: false});
    }, [report, shouldShowSkeleton]);

    const recordTimeToMeasureItemLayout = (event: LayoutChangeEvent) => {
        onLayout?.(event);
        if (didLayout.current) {
            return;
        }
        didLayout.current = true;
        if (report) {
            markOpenReportEnd(report, {warm: true});
        }
    };

    if (isLoadingOnyxValue(reportResult) || !report) {
        return <ReportActionsSkeletonView />;
    }

    if (shouldShowSkeleton) {
        return <ReportActionsSkeletonView />;
    }

    if ((hasDerivedValueTimingIssue || isMissingReportActions) && !showConciergeSidePanelWelcome) {
        return <ReportActionsSkeletonView shouldAnimate={false} />;
    }

    return (
        <>
            <ReportActionsList
                report={report}
                transactionThreadReport={undefined}
                parentReportAction={parentReportAction}
                parentReportActionForTransactionThread={undefined}
                onLayout={recordTimeToMeasureItemLayout}
                sortedReportActions={conciergeSidePanelFilteredReportActions}
                sortedVisibleReportActions={conciergeSidePanelFilteredVisibleActions}
                loadOlderChats={loadOlderChats}
                loadNewerChats={loadNewerChats}
                listID={listID}
                hasCreatedActionAdded={hasCreatedActionAdded}
                isConciergeSidePanel={isConciergeSidePanel}
                showHiddenHistory={!showFullHistory}
                hasPreviousMessages={hasPreviousMessages}
                onShowPreviousMessages={handleShowPreviousMessages}
            />
            <UserTypingEventListener report={report} />
        </>
    );
}

ChatReportActionsView.displayName = 'ChatReportActionsView';

export default ChatReportActionsView;
