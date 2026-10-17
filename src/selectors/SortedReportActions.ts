import {getCombinedReportActions, getOneTransactionThreadReportID, getSortedReportActions, withDEWRoutedActionsArray} from '@libs/ReportActionsUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, ReportAction, ReportActions} from '@src/types/onyx';

import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';

type SortedReportActionsData = {
    /** Sorted report actions keyed by report ID */
    sortedActions: Record<string, ReportAction[]>;

    /** Last report action for each report, keyed by report ID */
    lastActions: Record<string, ReportAction>;

    /** One-transaction thread report IDs keyed by report ID */
    transactionThreadIDs: Record<string, string | undefined>;
};

type ReportResult = {
    sortedReportActions: ReportAction[];
    transactionThreadReportID: string | undefined;
    lastAction: ReportAction | undefined;
};

type ReportCacheEntry = {
    report: OnyxEntry<Report>;
    chatReport: OnyxEntry<Report>;
    isOffline: boolean;
    transactionThreadReportActions: OnyxEntry<ReportActions>;
    ownSortedReportActions: ReportAction[];
    result: ReportResult;
};

const EMPTY_SORTED_REPORT_ACTIONS_DATA: SortedReportActionsData = {sortedActions: {}, lastActions: {}, transactionThreadIDs: {}};

function sortOwnReportActions(actions: ReportActions): ReportAction[] {
    return getSortedReportActions(withDEWRoutedActionsArray(Object.values(actions)), true);
}

function combineWithTransactionThread(
    ownSortedReportActions: ReportAction[],
    report: OnyxEntry<Report>,
    transactionThreadReportID: string | undefined,
    allReportActions: OnyxCollection<ReportActions>,
): ReportResult {
    let sortedReportActions = ownSortedReportActions;
    if (transactionThreadReportID && allReportActions) {
        const transactionThreadReportActionsArray = Object.values(allReportActions[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${transactionThreadReportID}`] ?? {});
        const isSelfDM = report?.chatType === CONST.REPORT.CHAT_TYPE.SELF_DM;
        sortedReportActions = getCombinedReportActions(sortedReportActions, transactionThreadReportID, transactionThreadReportActionsArray, isSelfDM);
    }

    return {
        sortedReportActions,
        transactionThreadReportID,
        lastAction: sortedReportActions.at(0),
    };
}

function computeForReport(reportID: string, actions: ReportActions, allReportActions: OnyxCollection<ReportActions>, allReports: OnyxCollection<Report>, isOffline: boolean): ReportResult {
    const report = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
    const chatReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.chatReportID}`];
    const transactionThreadReportID = getOneTransactionThreadReportID(report, chatReport, actions, isOffline);
    return combineWithTransactionThread(sortOwnReportActions(actions), report, transactionThreadReportID, allReportActions);
}

const reportCache = new WeakMap<ReportActions, ReportCacheEntry>();

function getTransactionThreadReportActions(allReportActions: OnyxCollection<ReportActions>, transactionThreadReportID: string | undefined): OnyxEntry<ReportActions> {
    return transactionThreadReportID ? allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${transactionThreadReportID}`] : undefined;
}

/**
 * Same result as computeForReport, cached on the frozen actions object of the report. The sort only reruns when the
 * report's own actions change, and the previous result object is reused when the report, its chat report, its
 * transaction thread actions and the offline state give the same output.
 */
function getReportResult(reportID: string, actions: ReportActions, allReportActions: OnyxCollection<ReportActions>, allReports: OnyxCollection<Report>, isOffline: boolean): ReportResult {
    const report = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
    const chatReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.chatReportID}`];
    const cachedEntry = reportCache.get(actions);
    if (
        cachedEntry &&
        cachedEntry.report === report &&
        cachedEntry.chatReport === chatReport &&
        cachedEntry.isOffline === isOffline &&
        cachedEntry.transactionThreadReportActions === getTransactionThreadReportActions(allReportActions, cachedEntry.result.transactionThreadReportID)
    ) {
        return cachedEntry.result;
    }

    const transactionThreadReportID = getOneTransactionThreadReportID(report, chatReport, actions, isOffline);
    const transactionThreadReportActions = getTransactionThreadReportActions(allReportActions, transactionThreadReportID);
    const ownSortedReportActions = cachedEntry?.ownSortedReportActions ?? sortOwnReportActions(actions);
    const canReuseResult =
        !!cachedEntry &&
        cachedEntry.result.transactionThreadReportID === transactionThreadReportID &&
        cachedEntry.transactionThreadReportActions === transactionThreadReportActions &&
        (!transactionThreadReportID || cachedEntry.report?.chatType === report?.chatType);
    const result = canReuseResult ? cachedEntry.result : combineWithTransactionThread(ownSortedReportActions, report, transactionThreadReportID, allReportActions);

    reportCache.set(actions, {report, chatReport, isOffline, transactionThreadReportActions, ownSortedReportActions, result});
    return result;
}

let lastAllReportActions: OnyxCollection<ReportActions>;
let lastAllReports: OnyxCollection<Report>;
let lastIsOffline: boolean | undefined;
let lastSortedReportActionsData = EMPTY_SORTED_REPORT_ACTIONS_DATA;

/**
 * Sorted actions, last action and one-transaction thread ID of every report that has actions. Every mounted consumer
 * shares one pass per write, a report is only recomputed when one of its inputs changed, and the previous object is
 * returned when no report changed, so consumers that compare it by reference skip their work.
 */
function getSortedReportActionsData(allReportActions: OnyxCollection<ReportActions>, allReports: OnyxCollection<Report>, isOffline: boolean): SortedReportActionsData {
    if (!allReportActions) {
        return EMPTY_SORTED_REPORT_ACTIONS_DATA;
    }
    if (allReportActions === lastAllReportActions && allReports === lastAllReports && isOffline === lastIsOffline) {
        return lastSortedReportActionsData;
    }

    const previousData = lastSortedReportActionsData;
    const sortedActions: SortedReportActionsData['sortedActions'] = {};
    const lastActions: SortedReportActionsData['lastActions'] = {};
    const transactionThreadIDs: SortedReportActionsData['transactionThreadIDs'] = {};
    let reportCount = 0;
    let hasChangedReport = false;

    for (const key of Object.keys(allReportActions)) {
        const actions = allReportActions[key];
        if (!actions) {
            continue;
        }

        const reportID = key.replace(ONYXKEYS.COLLECTION.REPORT_ACTIONS, '');
        if (!reportID) {
            continue;
        }

        const result = getReportResult(reportID, actions, allReportActions, allReports, isOffline);
        reportCount++;
        if (
            !(reportID in previousData.transactionThreadIDs) ||
            previousData.sortedActions[reportID] !== result.sortedReportActions ||
            previousData.transactionThreadIDs[reportID] !== result.transactionThreadReportID
        ) {
            hasChangedReport = true;
        }
        sortedActions[reportID] = result.sortedReportActions;
        transactionThreadIDs[reportID] = result.transactionThreadReportID;
        if (result.lastAction) {
            lastActions[reportID] = result.lastAction;
        }
    }

    lastAllReportActions = allReportActions;
    lastAllReports = allReports;
    lastIsOffline = isOffline;
    if (hasChangedReport || reportCount !== Object.keys(previousData.transactionThreadIDs).length) {
        lastSortedReportActionsData = {sortedActions, lastActions, transactionThreadIDs};
    }
    return lastSortedReportActionsData;
}

export {computeForReport, getSortedReportActionsData};
export type {SortedReportActionsData};
