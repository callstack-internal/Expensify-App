import {isActionableWhisperRequiringWritePermission, isActionOfType, isConciergeCategoryOptions, shouldReportActionBeVisible} from '@libs/ReportActionsUtils';
import {isSupportTicket} from '@libs/ReportUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, ReportAction, ReportActions, ReportNameValuePairs, VisibleReportActions} from '@src/types/onyx';

import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';

/**
 * Returns true if the action's visibility depends on runtime context that can't be cached,
 * such as write permissions, policy settings, or sibling actions.
 */
function shouldSkipCachingAction(action: ReportAction): boolean {
    return isActionableWhisperRequiringWritePermission(action) || isConciergeCategoryOptions(action) || isActionOfType(action, CONST.REPORT.ACTIONS.TYPE.MARKED_REIMBURSED);
}

/**
 * Builds a report's action-visibility map (keyed by `reportActionID`) from its full set of report
 * actions. Rebuilding the whole map rather than updating individual entries keeps deletions correct:
 * a removed action is absent from `reportActions`, so it drops out of the result.
 */
function computeReportVisibility(
    reportActions: ReportActions,
    currentUserAccountID: number | undefined,
    isSupportTicketReport: boolean,
    isReplacedSupportTicket: boolean,
): Record<string, boolean> {
    const reportVisibility: Record<string, boolean> = {};

    for (const [actionID, action] of Object.entries(reportActions)) {
        if (!action) {
            continue;
        }
        // Skip deprecated keys (e.g. sequenceNumber-keyed duplicates) so they
        // cannot overwrite the canonical entry's visibility with false.
        if (actionID !== action.reportActionID) {
            continue;
        }
        if (shouldSkipCachingAction(action)) {
            continue;
        }
        // A replacement ticket has its own active survey, so the original ticket's survey is stale.
        if (isReplacedSupportTicket && isActionOfType(action, CONST.REPORT.ACTIONS.TYPE.SUPPORT_SURVEY)) {
            reportVisibility[action.reportActionID] = false;
            continue;
        }
        reportVisibility[action.reportActionID] = shouldReportActionBeVisible(action, actionID, undefined, currentUserAccountID, undefined, isSupportTicketReport);
    }

    return reportVisibility;
}

type ReportVisibilityInputs = {
    currentUserAccountID: number | undefined;
    isSupportTicketReport: boolean;
    isReplacedSupportTicket: boolean;
};

// Onyx gives a report's actions a new object only when they change, so every consumer shares one compute per report, user and ticket state
const reportVisibilityCache = new WeakMap<ReportActions, ReportVisibilityInputs & {reportVisibility: Record<string, boolean>}>();

function isSameReportVisibility(reportVisibility: Record<string, boolean>, otherReportVisibility: Record<string, boolean>): boolean {
    const actionIDs = Object.keys(reportVisibility);
    if (actionIDs.length !== Object.keys(otherReportVisibility).length) {
        return false;
    }
    return actionIDs.every((actionID) => reportVisibility[actionID] === otherReportVisibility[actionID]);
}

function getReportVisibility(
    reportActions: ReportActions,
    currentUserAccountID: number | undefined,
    report: OnyxEntry<Report>,
    reportNameValuePairs: OnyxEntry<ReportNameValuePairs>,
    previousReportVisibility?: Record<string, boolean>,
): Record<string, boolean> {
    const isSupportTicketReport = isSupportTicket(report);
    const isReplacedSupportTicket = isSupportTicketReport && !!reportNameValuePairs?.reopenedAsReportID;
    const cached = reportVisibilityCache.get(reportActions);
    const isCacheHit =
        !!cached &&
        cached.currentUserAccountID === currentUserAccountID &&
        cached.isSupportTicketReport === isSupportTicketReport &&
        cached.isReplacedSupportTicket === isReplacedSupportTicket;
    let reportVisibility = isCacheHit ? cached.reportVisibility : computeReportVisibility(reportActions, currentUserAccountID, isSupportTicketReport, isReplacedSupportTicket);
    if (previousReportVisibility && reportVisibility !== previousReportVisibility && isSameReportVisibility(reportVisibility, previousReportVisibility)) {
        reportVisibility = previousReportVisibility;
    }
    if (!isCacheHit || reportVisibility !== cached.reportVisibility) {
        reportVisibilityCache.set(reportActions, {currentUserAccountID, isSupportTicketReport, isReplacedSupportTicket, reportVisibility});
    }
    return reportVisibility;
}

type ReportVisibilityEntry = {
    reportID: string;
    reportActions: OnyxEntry<ReportActions>;
    report: OnyxEntry<Report>;
    reportNameValuePairs: OnyxEntry<ReportNameValuePairs>;
};

/** The visibility of the given reports' actions, keyed by reportID. Reports without actions are left out. */
function getVisibleReportActionsForReports(entries: ReportVisibilityEntry[], currentUserAccountID: number | undefined): VisibleReportActions | undefined {
    let result: VisibleReportActions | undefined;
    for (const {reportID, reportActions, report, reportNameValuePairs} of entries) {
        if (!reportActions) {
            continue;
        }
        result ??= {};
        result[reportID] = getReportVisibility(reportActions, currentUserAccountID, report, reportNameValuePairs);
    }
    return result;
}

let lastAllReportActions: OnyxCollection<ReportActions> | undefined;
let lastAllReports: OnyxCollection<Report> | undefined;
let lastAllReportNameValuePairs: OnyxCollection<ReportNameValuePairs> | undefined;
let lastCurrentUserAccountID: number | undefined;
let lastAllVisibleReportActions: VisibleReportActions | undefined;

/**
 * The visibility of every report's actions, keyed by reportID. Every mounted consumer shares one walk per collection
 * snapshot. A report whose visibility didn't change keeps its previous object, and so does the whole map when no report changed.
 */
function getAllVisibleReportActions(
    allReportActions: OnyxCollection<ReportActions>,
    allReports: OnyxCollection<Report>,
    allReportNameValuePairs: OnyxCollection<ReportNameValuePairs>,
    currentUserAccountID: number | undefined,
): VisibleReportActions {
    if (
        lastAllVisibleReportActions &&
        allReportActions === lastAllReportActions &&
        allReports === lastAllReports &&
        allReportNameValuePairs === lastAllReportNameValuePairs &&
        currentUserAccountID === lastCurrentUserAccountID
    ) {
        return lastAllVisibleReportActions;
    }

    const previous = lastAllVisibleReportActions;
    const result: VisibleReportActions = {};
    let reportCount = 0;
    let isSameAsPrevious = !!previous;
    for (const [reportActionsKey, reportActions] of Object.entries(allReportActions ?? {})) {
        if (!reportActions) {
            continue;
        }
        const reportID = reportActionsKey.replace(ONYXKEYS.COLLECTION.REPORT_ACTIONS, '');
        const report = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
        const reportNameValuePairs = allReportNameValuePairs?.[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${reportID}`];
        const reportVisibility = getReportVisibility(reportActions, currentUserAccountID, report, reportNameValuePairs, previous?.[reportID]);
        result[reportID] = reportVisibility;
        reportCount++;
        if (isSameAsPrevious && previous?.[reportID] !== reportVisibility) {
            isSameAsPrevious = false;
        }
    }

    lastAllReportActions = allReportActions;
    lastAllReports = allReports;
    lastAllReportNameValuePairs = allReportNameValuePairs;
    lastCurrentUserAccountID = currentUserAccountID;
    if (previous && isSameAsPrevious && Object.keys(previous).length === reportCount) {
        return previous;
    }
    lastAllVisibleReportActions = result;
    return result;
}

export {computeReportVisibility, getAllVisibleReportActions, getVisibleReportActionsForReports};
export type {ReportVisibilityEntry};
