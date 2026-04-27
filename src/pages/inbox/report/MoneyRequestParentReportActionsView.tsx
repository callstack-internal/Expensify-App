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
import useReportTransactionsCollection from '@hooks/useReportTransactionsCollection';
import {getReportPreviewAction} from '@libs/actions/IOU';
import {updateLoadingInitialReportAction} from '@libs/actions/Report';
import DateUtils from '@libs/DateUtils';
import {getAllNonDeletedTransactions} from '@libs/MoneyRequestReportUtils';
import type {PlatformStackRouteProp} from '@libs/Navigation/PlatformStackNavigation/types';
import type {ReportsSplitNavigatorParamList} from '@libs/Navigation/types';
import {generateNewRandomInt, rand64} from '@libs/NumberUtils';
import {
    getCombinedReportActions,
    getFilteredReportActionsForReportView,
    getOneTransactionThreadReportID,
    getOriginalMessage,
    getSortedReportActionsForDisplay,
    isCreatedAction,
    isDeletedParentAction,
    isIOUActionMatchingTransactionList,
    isMoneyRequestAction,
    isReportActionVisible,
} from '@libs/ReportActionsUtils';
import {buildOptimisticCreatedReportAction, buildOptimisticIOUReportAction, canUserPerformWriteAction, isMoneyRequestReport} from '@libs/ReportUtils';
import markOpenReportEnd from '@libs/telemetry/markOpenReportEnd';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';
import type * as OnyxTypes from '@src/types/onyx';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import isLoadingOnyxValue from '@src/types/utils/isLoadingOnyxValue';
import ReportActionsList from './ReportActionsList';
import UserTypingEventListener from './UserTypingEventListener';

type MoneyRequestParentReportActionsViewProps = {
    /** The ID of the money-request / invoice parent report to display actions for */
    reportID: string | undefined;

    /** Callback executed on layout */
    onLayout?: (event: LayoutChangeEvent) => void;
};

function MoneyRequestParentReportActionsView({reportID, onLayout}: MoneyRequestParentReportActionsViewProps) {
    useCopySelectionHelper();
    const didLayout = useRef(false);
    const route = useRoute<PlatformStackRouteProp<ReportsSplitNavigatorParamList, typeof SCREENS.REPORT>>();
    const {isOffline} = useNetwork();
    const reportActionID = route?.params?.reportActionID;

    const [report, reportResult] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const [reportMetadata] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_METADATA}${reportID}`);
    const [chatReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${report?.chatReportID}`);
    const [isLoadingApp] = useOnyx(ONYXKEYS.IS_LOADING_APP);
    const [visibleReportActionsData] = useOnyx(ONYXKEYS.DERIVED.VISIBLE_REPORT_ACTIONS);

    const {reportActions: unfilteredReportActions, hasNewerActions, hasOlderActions} = usePaginatedReportActions(reportID, reportActionID);
    const allReportActions = getFilteredReportActionsForReportView(unfilteredReportActions);

    const parentReportAction = useParentReportAction(report);
    const isReportArchived = useReportIsArchived(reportID);
    const canPerformWriteAction = canUserPerformWriteAction(report, isReportArchived);

    const allReportTransactions = useReportTransactionsCollection(reportID);
    const reportTransactionsForThreadID = getAllNonDeletedTransactions(allReportTransactions, allReportActions ?? [], isOffline, true);
    const visibleTransactionsForThreadID = reportTransactionsForThreadID?.filter((transaction) => isOffline || transaction.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE);
    const reportTransactionIDsForThread = visibleTransactionsForThreadID?.map((t) => t.transactionID);
    const transactionThreadReportID = getOneTransactionThreadReportID(report, chatReport, allReportActions ?? [], isOffline, reportTransactionIDsForThread);

    const getTransactionThreadReportActions = (reportActions: OnyxTypes.ReportActions | undefined): OnyxTypes.ReportAction[] => {
        return getSortedReportActionsForDisplay(reportActions, canPerformWriteAction, true, undefined, transactionThreadReportID ?? undefined);
    };
    const [transactionThreadReportActions] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${transactionThreadReportID}`, {selector: getTransactionThreadReportActions}, [
        getTransactionThreadReportActions,
    ]);
    const [transactionThreadReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${transactionThreadReportID}`);

    const reportTransactionIDs = getAllNonDeletedTransactions(allReportTransactions, allReportActions ?? []).map((transaction) => transaction.transactionID);

    const reportPreviewAction = getReportPreviewAction(report?.chatReportID, report?.reportID);

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
    // We're routed here only for MR / Invoice parents, so the original
    // `isMoneyRequestReport(report) || isInvoiceReport(report)` clause of the
    // shared `shouldAddCreatedAction` always holds. The only remaining gate is the
    // last action not already being CREATED.
    const hasCreatedActionAdded = !isCreatedAction(lastAction);

    // When we are offline before opening an IOU/Expense report, the total of the report and sometimes the
    // expense aren't displayed because these actions aren't returned until `OpenReport` API is complete.
    // We generate a fake created action here if it doesn't exist to display the total whenever possible
    // because the total just depends on report data, and we also generate an expense action if the number of
    // expenses in allReportActions is less than the total number of expenses to display at least one expense
    // action to match the total data.
    const actions: OnyxTypes.ReportAction[] = [...(allReportActions ?? [])];

    if (hasCreatedActionAdded) {
        const createdTime = lastAction?.created && DateUtils.subtractMillisecondsFromDateTime(lastAction.created, 1);
        const optimisticCreatedAction = buildOptimisticCreatedReportAction(String(report?.ownerAccountID), createdTime);
        optimisticCreatedAction.pendingAction = null;
        actions.push(optimisticCreatedAction);
    }

    let reportActionsToDisplay: OnyxTypes.ReportAction[] = actions;
    if (isMoneyRequestReport(report) && allReportActions?.length) {
        const moneyRequestActions = allReportActions.filter((action) => {
            const originalMessage = isMoneyRequestAction(action) ? getOriginalMessage(action) : undefined;
            return (
                isMoneyRequestAction(action) &&
                originalMessage &&
                (originalMessage?.type === CONST.IOU.REPORT_ACTION_TYPE.CREATE ||
                    !!(originalMessage?.type === CONST.IOU.REPORT_ACTION_TYPE.PAY && originalMessage?.IOUDetails) ||
                    originalMessage?.type === CONST.IOU.REPORT_ACTION_TYPE.TRACK)
            );
        });

        if (report?.total && moneyRequestActions.length < (reportPreviewAction?.childMoneyRequestCount ?? 0) && isEmptyObject(transactionThreadReport)) {
            const optimisticIOUAction = buildOptimisticIOUReportAction({
                type: CONST.IOU.REPORT_ACTION_TYPE.CREATE,
                amount: 0,
                currency: CONST.CURRENCY.USD,
                comment: '',
                participants: [],
                transactionID: rand64(),
                iouReportID: report?.reportID,
                created: DateUtils.subtractMillisecondsFromDateTime(actions.at(-1)?.created ?? '', 1),
            }) as OnyxTypes.ReportAction;
            moneyRequestActions.push(optimisticIOUAction);
            actions.splice(actions.length - 1, 0, optimisticIOUAction);
        }

        // Update pending action of created action if we have some requests that are pending.
        const createdAction = actions.pop();
        if (createdAction) {
            if (moneyRequestActions.filter((action) => !!action.pendingAction).length > 0) {
                createdAction.pendingAction = CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE;
            }
            reportActionsToDisplay = [...actions, createdAction];
        } else {
            reportActionsToDisplay = actions;
        }
    }

    // Get a sorted array of reportActions for both the current report and the transaction thread report
    // associated with this report (if there is one) so that we display transaction-level and report-level
    // report actions in order in the one-transaction view.
    const reportActions = getCombinedReportActions(reportActionsToDisplay, transactionThreadReportID ?? null, transactionThreadReportActions ?? []);

    const parentReportActionForTransactionThread = isEmptyObject(transactionThreadReportActions)
        ? undefined
        : allReportActions?.find((action) => action.reportActionID === transactionThreadReport?.parentReportActionID);

    const visibleReportActions = reportActions.filter((reportAction) => {
        const passesOfflineCheck = isOffline || isDeletedParentAction(reportAction) || reportAction.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE || reportAction.errors;
        if (!passesOfflineCheck) {
            return false;
        }
        const actionReportID = reportAction.reportID ?? reportID;
        if (!isReportActionVisible(reportAction, actionReportID, canPerformWriteAction, visibleReportActionsData)) {
            return false;
        }
        if (!isIOUActionMatchingTransactionList(reportAction, reportTransactionIDs)) {
            return false;
        }
        return true;
    });

    const allReportActionIDs = (allReportActions ?? []).map((action) => action.reportActionID);

    const {loadOlderChats, loadNewerChats} = useLoadReportActions({
        reportID,
        reportActions,
        allReportActionIDs,
        transactionThreadReport,
        hasOlderActions,
        hasNewerActions,
    });

    const isSingleExpenseReport = reportPreviewAction?.childMoneyRequestCount === 1;
    const isMissingTransactionThreadReportID = !transactionThreadReport?.reportID;
    const isReportDataIncomplete = isSingleExpenseReport && isMissingTransactionThreadReportID;
    const isMissingReportActions = visibleReportActions.length === 0;
    const shouldShowSkeletonForInitialLoad = !!isLoadingInitialReportActions && (isReportDataIncomplete || isMissingReportActions) && !isOffline;
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

    if (hasDerivedValueTimingIssue || isMissingReportActions) {
        return <ReportActionsSkeletonView shouldAnimate={false} />;
    }

    return (
        <>
            <ReportActionsList
                report={report}
                transactionThreadReport={transactionThreadReport}
                parentReportAction={parentReportAction}
                parentReportActionForTransactionThread={parentReportActionForTransactionThread}
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

MoneyRequestParentReportActionsView.displayName = 'MoneyRequestParentReportActionsView';

export default MoneyRequestParentReportActionsView;
