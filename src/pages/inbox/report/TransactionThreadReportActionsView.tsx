import {useRoute} from '@react-navigation/native';
import React, {useEffect, useRef, useState} from 'react';
import type {LayoutChangeEvent} from 'react-native';
import ReportActionsSkeletonView from '@components/ReportActionsSkeletonView';
import useCopySelectionHelper from '@hooks/useCopySelectionHelper';
import useLoadReportActions from '@hooks/useLoadReportActions';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import usePaginatedReportActions from '@hooks/usePaginatedReportActions';
import useParentReportAction from '@hooks/useParentReportAction';
import useReportIsArchived from '@hooks/useReportIsArchived';
import {updateLoadingInitialReportAction} from '@libs/actions/Report';
import DateUtils from '@libs/DateUtils';
import type {PlatformStackRouteProp} from '@libs/Navigation/PlatformStackNavigation/types';
import type {ReportsSplitNavigatorParamList} from '@libs/Navigation/types';
import {generateNewRandomInt} from '@libs/NumberUtils';
import {getFilteredReportActionsForReportView, isCreatedAction, isDeletedParentAction, isIOUActionMatchingTransactionList, isReportActionVisible} from '@libs/ReportActionsUtils';
import {buildOptimisticCreatedReportAction, canUserPerformWriteAction} from '@libs/ReportUtils';
import markOpenReportEnd from '@libs/telemetry/markOpenReportEnd';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';
import type * as OnyxTypes from '@src/types/onyx';
import isLoadingOnyxValue from '@src/types/utils/isLoadingOnyxValue';
import ReportActionsList from './ReportActionsList';
import UserTypingEventListener from './UserTypingEventListener';

// Transaction-thread leaf reports never have a child transaction-thread to merge from.
// Hardcoding an empty list keeps the visibility filter byte-identical with the previous
// shared `ReportActionsView`, which read this list from a derived value that returned an
// empty object for TT-leaf reportIDs.
const TT_LEAF_REPORT_TRANSACTION_IDS: string[] = [];

type TransactionThreadReportActionsViewProps = {
    /** The ID of the transaction thread report to display actions for */
    reportID: string | undefined;

    /** Callback executed on layout */
    onLayout?: (event: LayoutChangeEvent) => void;
};

function TransactionThreadReportActionsView({reportID, onLayout}: TransactionThreadReportActionsViewProps) {
    useCopySelectionHelper();
    const didLayout = useRef(false);
    const route = useRoute<PlatformStackRouteProp<ReportsSplitNavigatorParamList, typeof SCREENS.REPORT>>();
    const {isOffline} = useNetwork();
    const reportActionID = route?.params?.reportActionID;

    const [report, reportResult] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const [reportMetadata] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_METADATA}${reportID}`);
    const [isLoadingApp] = useOnyx(ONYXKEYS.IS_LOADING_APP);
    const [visibleReportActionsData] = useOnyx(ONYXKEYS.DERIVED.VISIBLE_REPORT_ACTIONS);

    const {reportActions: unfilteredReportActions, hasNewerActions, hasOlderActions} = usePaginatedReportActions(reportID, reportActionID);
    const allReportActions = getFilteredReportActionsForReportView(unfilteredReportActions);

    const parentReportAction = useParentReportAction(report);
    const isReportArchived = useReportIsArchived(reportID);
    const canPerformWriteAction = canUserPerformWriteAction(report, isReportArchived);

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
    const lastAction = allReportActions?.at(-1);

    // For TT-leaf, `shouldAddCreatedAction` collapses to the `isInitiallyLoadingTransactionThread`
    // branch from the original union — the MR-parent / invoice / concierge branches never apply here.
    const isInitiallyLoadingTransactionThread = !!isLoadingInitialReportActions || (allReportActions ?? []).length <= 1;
    const hasCreatedActionAdded = !isCreatedAction(lastAction) && isInitiallyLoadingTransactionThread;

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
        if (!isIOUActionMatchingTransactionList(reportAction, TT_LEAF_REPORT_TRANSACTION_IDS)) {
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

    const isMissingReportActions = visibleReportActions.length === 0;
    const shouldShowSkeletonForInitialLoad = !!isLoadingInitialReportActions && isMissingReportActions && !isOffline;
    const shouldShowSkeletonForAppLoad = !!isLoadingApp && !isOffline;
    const shouldShowSkeleton = shouldShowSkeletonForInitialLoad || shouldShowSkeletonForAppLoad;
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

    if (hasDerivedValueTimingIssue) {
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
                sortedReportActions={reportActions}
                sortedVisibleReportActions={visibleReportActions}
                loadOlderChats={loadOlderChats}
                loadNewerChats={loadNewerChats}
                listID={listID}
                hasCreatedActionAdded={hasCreatedActionAdded}
            />
            <UserTypingEventListener report={report} />
        </>
    );
}

TransactionThreadReportActionsView.displayName = 'TransactionThreadReportActionsView';

export default TransactionThreadReportActionsView;
