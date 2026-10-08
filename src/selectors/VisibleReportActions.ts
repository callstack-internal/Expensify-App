import {isActionableWhisperRequiringWritePermission, isActionOfType, isConciergeCategoryOptions, shouldReportActionBeVisible} from '@libs/ReportActionsUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportAction, ReportActions, VisibleReportActions} from '@src/types/onyx';

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
function computeReportVisibility(reportActions: ReportActions, currentUserAccountID: number | undefined): Record<string, boolean> {
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
        reportVisibility[action.reportActionID] = shouldReportActionBeVisible(action, actionID, undefined, currentUserAccountID);
    }

    return reportVisibility;
}

// Onyx gives a report's actions a new object only when they change, so every consumer shares one compute per report and user
const reportVisibilityCache = new WeakMap<ReportActions, {currentUserAccountID: number | undefined; reportVisibility: Record<string, boolean>}>();

function getReportVisibility(reportActions: ReportActions, currentUserAccountID: number | undefined): Record<string, boolean> {
    const cached = reportVisibilityCache.get(reportActions);
    if (cached && cached.currentUserAccountID === currentUserAccountID) {
        return cached.reportVisibility;
    }
    const reportVisibility = computeReportVisibility(reportActions, currentUserAccountID);
    reportVisibilityCache.set(reportActions, {currentUserAccountID, reportVisibility});
    return reportVisibility;
}

/** The visibility of the given reports' actions, keyed by reportID. Reports without actions are left out. */
function getVisibleReportActionsForReports(reportActionsByReportID: Array<[string, OnyxEntry<ReportActions>]>, currentUserAccountID: number | undefined): VisibleReportActions | undefined {
    let result: VisibleReportActions | undefined;
    for (const [reportID, reportActions] of reportActionsByReportID) {
        if (!reportActions) {
            continue;
        }
        result ??= {};
        result[reportID] = getReportVisibility(reportActions, currentUserAccountID);
    }
    return result;
}

function isSameReportVisibility(reportVisibility: Record<string, boolean>, otherReportVisibility: Record<string, boolean>): boolean {
    const actionIDs = Object.keys(reportVisibility);
    if (actionIDs.length !== Object.keys(otherReportVisibility).length) {
        return false;
    }
    return actionIDs.every((actionID) => reportVisibility[actionID] === otherReportVisibility[actionID]);
}

let lastAllReportActions: OnyxCollection<ReportActions> | undefined;
let lastCurrentUserAccountID: number | undefined;
let lastAllVisibleReportActions: VisibleReportActions | undefined;

/**
 * The visibility of every report's actions, keyed by reportID. Every mounted consumer shares one walk per collection
 * snapshot. A report whose visibility didn't change keeps its previous object, and so does the whole map when no report changed.
 */
function getAllVisibleReportActions(allReportActions: OnyxCollection<ReportActions>, currentUserAccountID: number | undefined): VisibleReportActions {
    if (lastAllVisibleReportActions && allReportActions === lastAllReportActions && currentUserAccountID === lastCurrentUserAccountID) {
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
        const previousReportVisibility = previous?.[reportID];
        let reportVisibility = getReportVisibility(reportActions, currentUserAccountID);
        if (previousReportVisibility && reportVisibility !== previousReportVisibility && isSameReportVisibility(reportVisibility, previousReportVisibility)) {
            reportVisibility = previousReportVisibility;
            reportVisibilityCache.set(reportActions, {currentUserAccountID, reportVisibility});
        }
        result[reportID] = reportVisibility;
        reportCount++;
        if (isSameAsPrevious && previous?.[reportID] !== reportVisibility) {
            isSameAsPrevious = false;
        }
    }

    lastAllReportActions = allReportActions;
    lastCurrentUserAccountID = currentUserAccountID;
    if (previous && isSameAsPrevious && Object.keys(previous).length === reportCount) {
        return previous;
    }
    lastAllVisibleReportActions = result;
    return result;
}

export {computeReportVisibility, getAllVisibleReportActions, getVisibleReportActionsForReports};
