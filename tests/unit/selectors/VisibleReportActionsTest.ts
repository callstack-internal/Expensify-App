/* eslint-disable @typescript-eslint/naming-convention */
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, ReportAction, ReportActions, ReportNameValuePairs} from '@src/types/onyx';

import type {OnyxCollection} from 'react-native-onyx';

import {computeReportVisibility, getAllVisibleReportActions, getVisibleReportActionsForReports} from '@selectors/VisibleReportActions';

import {getFakeReportAction} from '../../utils/ReportTestUtils';

const CURRENT_USER_ACCOUNT_ID = 10;
const OTHER_USER_ACCOUNT_ID = 20;

function createComment(reportActionID: number, overrides: Partial<ReportAction> = {}): ReportAction {
    return getFakeReportAction(reportActionID, {actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT, ...overrides});
}

function toReportActions(...actions: ReportAction[]): ReportActions {
    return Object.fromEntries(actions.map((action) => [action.reportActionID, action]));
}

function toEntry(reportID: string, reportActions: ReportActions | undefined, report?: Report, reportNameValuePairs?: ReportNameValuePairs) {
    return {reportID, reportActions, report, reportNameValuePairs};
}

function toCollection(reportActionsByReportID: Record<string, ReportActions>): OnyxCollection<ReportActions> {
    return Object.fromEntries(Object.entries(reportActionsByReportID).map(([reportID, reportActions]) => [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`, reportActions]));
}

describe('computeReportVisibility', () => {
    it('should skip deprecated keys and actions whose visibility depends on runtime context', () => {
        // Given a visible comment, the same comment under a deprecated key, and a MARKED_REIMBURSED whose visibility depends on its siblings
        const comment = createComment(1);
        const markedReimbursed = createComment(2, {actionName: CONST.REPORT.ACTIONS.TYPE.MARKED_REIMBURSED, originalMessage: {}});
        const reportActions: ReportActions = {...toReportActions(comment, markedReimbursed), deprecatedKey: comment};

        // When the report's visibility is computed
        const visibility = computeReportVisibility(reportActions, CURRENT_USER_ACCOUNT_ID, false, false);

        // Then only the canonical comment is cached, so the other two fall back to the runtime check
        expect(visibility).toEqual({[comment.reportActionID]: true});
    });
});

describe('getVisibleReportActionsForReports', () => {
    it('should reuse a report visibility for the same actions object and user and recompute for another user', () => {
        // Given a report's actions
        const reportActions = toReportActions(createComment(1));

        // When the selector runs twice for the same user, then once for another user
        const first = getVisibleReportActionsForReports([toEntry('1', reportActions)], CURRENT_USER_ACCOUNT_ID);
        const second = getVisibleReportActionsForReports([toEntry('1', reportActions)], CURRENT_USER_ACCOUNT_ID);
        const otherUser = getVisibleReportActionsForReports([toEntry('1', reportActions)], OTHER_USER_ACCOUNT_ID);

        // Then mounted LHN rows share one compute per report, while a user switch doesn't reuse a result for the previous user
        expect(second?.['1']).toBe(first?.['1']);
        expect(otherUser?.['1']).not.toBe(first?.['1']);
    });

    it('should leave out reports without actions', () => {
        // Given a report with actions and a transaction thread without any

        // When the selector runs for both
        const result = getVisibleReportActionsForReports([toEntry('1', toReportActions(createComment(1))), toEntry('2', undefined)], CURRENT_USER_ACCOUNT_ID);

        // Then only the report with actions has an entry, as in the derived value it replaces
        expect(Object.keys(result ?? {})).toEqual(['1']);
    });
});

describe('getAllVisibleReportActions', () => {
    it('should return the previous map when a write leaves every report visibility unchanged', () => {
        // Given two reports
        const comment = createComment(1);
        const otherReportActions = toReportActions(createComment(2));
        const previous = getAllVisibleReportActions(toCollection({'1': toReportActions(comment), '2': otherReportActions}), {}, {}, CURRENT_USER_ACCOUNT_ID);

        // When the comment is edited, which gives the report's actions and the collection new objects without changing visibility
        const next = getAllVisibleReportActions(
            toCollection({'1': toReportActions({...comment, lastModified: '2025-01-01 00:00:00.000'}), '2': otherReportActions}),
            {},
            {},
            CURRENT_USER_ACCOUNT_ID,
        );

        // Then the same map object comes back, so Search consumers pass Object.is without a deep walk over every report
        expect(next).toBe(previous);
    });

    it('should keep untouched reports and drop removed ones when a report changes', () => {
        // Given three reports
        const otherReportActions = toReportActions(createComment(2));
        const previous = getAllVisibleReportActions(
            toCollection({'1': toReportActions(createComment(1)), '2': otherReportActions, '3': toReportActions(createComment(3))}),
            {},
            {},
            CURRENT_USER_ACCOUNT_ID,
        );

        // When a comment is added to the first report and the third report's actions are removed
        const next = getAllVisibleReportActions(toCollection({'1': toReportActions(createComment(1), createComment(4)), '2': otherReportActions}), {}, {}, CURRENT_USER_ACCOUNT_ID);

        // Then the map is new, the untouched report keeps its object, and the removed report is gone
        expect(next).not.toBe(previous);
        expect(next).toEqual({'1': {'1': true, '4': true}, '2': {'2': true}});
        expect(next['2']).toBe(previous['2']);
    });
});

describe('support ticket visibility', () => {
    const REPORT_ID = '1';
    const UNRELATED_REPORT_ID = '2';
    const SURVEY_ACTION_ID = '10';
    const supportTicket = {reportID: REPORT_ID, type: CONST.REPORT.TYPE.SUPPORT_TICKET} as Report;
    const survey = createComment(Number(SURVEY_ACTION_ID), {actionName: CONST.REPORT.ACTIONS.TYPE.SUPPORT_SURVEY});

    it('should hide the support survey when the ticket has been replaced', () => {
        // Given a support ticket whose survey was visible before the replacement ticket arrived
        const reportActions = toReportActions(survey);
        const before = getVisibleReportActionsForReports([toEntry(REPORT_ID, reportActions, supportTicket)], CURRENT_USER_ACCOUNT_ID);

        // When the ticket is reopened as another report
        const after = getVisibleReportActionsForReports([toEntry(REPORT_ID, reportActions, supportTicket, {reopenedAsReportID: '99'})], CURRENT_USER_ACCOUNT_ID);

        // Then the original ticket's survey is hidden, because the replacement has its own active survey
        expect(before?.[REPORT_ID]?.[SURVEY_ACTION_ID]).toBe(true);
        expect(after?.[REPORT_ID]?.[SURVEY_ACTION_ID]).toBe(false);
    });

    it('should not hide the survey of a report that is not a support ticket', () => {
        // Given a regular report with a reopenedAsReportID
        const reportActions = toReportActions(survey);

        // When its visibility is computed
        const result = getVisibleReportActionsForReports(
            [toEntry(REPORT_ID, reportActions, {reportID: REPORT_ID, type: CONST.REPORT.TYPE.CHAT} as Report, {reopenedAsReportID: '99'})],
            CURRENT_USER_ACCOUNT_ID,
        );

        // Then the replacement rule does not apply
        expect(result?.[REPORT_ID]?.[SURVEY_ACTION_ID]).not.toBe(false);
    });

    it('should recompute the whole map when a ticket is replaced and keep unrelated reports untouched', () => {
        // Given a support ticket and an unrelated report
        const reportActions = toReportActions(survey);
        const otherReportActions = toReportActions(createComment(2));
        const allReportActions = toCollection({[REPORT_ID]: reportActions, [UNRELATED_REPORT_ID]: otherReportActions});
        const allReports = {[`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`]: supportTicket};
        const previous = getAllVisibleReportActions(allReportActions, allReports, {}, CURRENT_USER_ACCOUNT_ID);

        // When the ticket gets a replacement
        const next = getAllVisibleReportActions(
            allReportActions,
            allReports,
            {[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${REPORT_ID}`]: {reopenedAsReportID: '99'}},
            CURRENT_USER_ACCOUNT_ID,
        );

        // Then the survey is hidden and the unrelated report keeps its object
        expect(previous[REPORT_ID]?.[SURVEY_ACTION_ID]).toBe(true);
        expect(next[REPORT_ID]?.[SURVEY_ACTION_ID]).toBe(false);
        expect(next[UNRELATED_REPORT_ID]).toBe(previous[UNRELATED_REPORT_ID]);
    });
});
