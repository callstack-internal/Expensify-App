import {act, renderHook} from '@testing-library/react-native';

import useSortedReportActionsData from '@hooks/useSortedReportActionsData';

import * as ReportActionsUtils from '@libs/ReportActionsUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, ReportAction, ReportActions} from '@src/types/onyx';

import type {OnyxCollection, OnyxUpdate} from 'react-native-onyx';

import {computeForReport, getSortedReportActionsData} from '@selectors/SortedReportActions';
import Onyx from 'react-native-onyx';

import {createMockReport, getFakeReportAction} from '../utils/ReportTestUtils';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

const CHAT_REPORT_ID = '10';
const EXPENSE_REPORT_ID = '20';
const PARENT_CHAT_REPORT_ID = '30';
const THREAD_REPORT_ID = '40';

function reportActionsKey<TReportID extends string>(reportID: TReportID) {
    return `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}` as const;
}

function reportKey<TReportID extends string>(reportID: TReportID) {
    return `${ONYXKEYS.COLLECTION.REPORT}${reportID}` as const;
}

function createComment(id: number, created: string): ReportAction {
    return getFakeReportAction(id, {actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT, created});
}

function createIOUAction(id: number, overrides: Partial<ReportAction> = {}): ReportAction {
    return getFakeReportAction(id, {
        actionName: CONST.REPORT.ACTIONS.TYPE.IOU,
        childReportID: THREAD_REPORT_ID,
        created: '2024-01-01 10:00:00.000',
        originalMessage: {IOUTransactionID: `txn${id}`, IOUReportID: EXPENSE_REPORT_ID, type: CONST.IOU.REPORT_ACTION_TYPE.CREATE, amount: 100, currency: 'USD'},
        ...overrides,
    } as Partial<ReportAction>);
}

function toReportActions(...actions: ReportAction[]): ReportActions {
    return Object.fromEntries(actions.map((action) => [action.reportActionID, action]));
}

/** A chat with two comments, and a one-transaction expense report whose thread has one comment. */
function buildInputs() {
    const allReportActions: OnyxCollection<ReportActions> = {
        [reportActionsKey(CHAT_REPORT_ID)]: toReportActions(createComment(1, '2024-01-01 09:00:00.000'), createComment(2, '2024-01-01 09:30:00.000')),
        [reportActionsKey(EXPENSE_REPORT_ID)]: toReportActions(createIOUAction(100)),
        [reportActionsKey(THREAD_REPORT_ID)]: toReportActions(createComment(200, '2024-01-01 11:00:00.000')),
    };
    const allReports: OnyxCollection<Report> = {
        [reportKey(CHAT_REPORT_ID)]: createMockReport({reportID: CHAT_REPORT_ID, type: CONST.REPORT.TYPE.CHAT}),
        [reportKey(EXPENSE_REPORT_ID)]: createMockReport({reportID: EXPENSE_REPORT_ID, type: CONST.REPORT.TYPE.EXPENSE, chatReportID: PARENT_CHAT_REPORT_ID}),
        [reportKey(PARENT_CHAT_REPORT_ID)]: createMockReport({reportID: PARENT_CHAT_REPORT_ID, type: CONST.REPORT.TYPE.CHAT}),
    };
    return {allReportActions, allReports};
}

describe('getSortedReportActionsData', () => {
    it('should give every report the same result as computeForReport', () => {
        // Given a chat and a one-transaction expense report with its thread
        const {allReportActions, allReports} = buildInputs();

        // When the data is built
        const data = getSortedReportActionsData(allReportActions, allReports, false);

        // Then each report matches a fresh compute, so consumers get what the derived value gave them
        for (const reportID of [CHAT_REPORT_ID, EXPENSE_REPORT_ID, THREAD_REPORT_ID]) {
            const expected = computeForReport(reportID, allReportActions?.[reportActionsKey(reportID)] ?? {}, allReportActions, allReports, false);
            expect(data.sortedActions[reportID]).toEqual(expected.sortedReportActions);
            expect(data.lastActions[reportID]).toEqual(expected.lastAction);
            expect(data.transactionThreadIDs[reportID]).toBe(expected.transactionThreadReportID);
        }
        expect(data.transactionThreadIDs[EXPENSE_REPORT_ID]).toBe(THREAD_REPORT_ID);
    });

    it('should return the previous object when a new snapshot leaves every report input unchanged', () => {
        // Given data built from a set of inputs
        const {allReportActions, allReports} = buildInputs();
        const data = getSortedReportActionsData(allReportActions, allReports, false);

        // When a report without actions is added, which gives both collections a new reference
        const nextReports = {...allReports, [reportKey('999')]: createMockReport({reportID: '999'})};
        const nextData = getSortedReportActionsData({...allReportActions}, nextReports, false);

        // Then the same object comes back, so consumers comparing by reference skip their work
        expect(nextData).toBe(data);
    });

    it('should keep the arrays of untouched reports when another report gets a new action', () => {
        // Given data built from a set of inputs
        const {allReportActions, allReports} = buildInputs();
        const data = getSortedReportActionsData(allReportActions, allReports, false);

        // When the chat gets a new comment
        const newComment = createComment(3, '2024-01-01 12:00:00.000');
        const nextReportActions = {
            ...allReportActions,
            [reportActionsKey(CHAT_REPORT_ID)]: {...allReportActions?.[reportActionsKey(CHAT_REPORT_ID)], [newComment.reportActionID]: newComment},
        };
        const nextData = getSortedReportActionsData(nextReportActions, allReports, false);

        // Then only the chat is rebuilt and the expense report keeps its array
        expect(nextData).not.toBe(data);
        expect(nextData.lastActions[CHAT_REPORT_ID]).toBe(newComment);
        expect(nextData.sortedActions[EXPENSE_REPORT_ID]).toBe(data.sortedActions[EXPENSE_REPORT_ID]);
    });

    it('should rebuild the parent report when only its transaction thread gets a new action', () => {
        // Given data built from a set of inputs
        const {allReportActions, allReports} = buildInputs();
        getSortedReportActionsData(allReportActions, allReports, false);

        // When the transaction thread gets a new comment
        const threadComment = createComment(201, '2024-01-01 13:00:00.000');
        const nextReportActions = {
            ...allReportActions,
            [reportActionsKey(THREAD_REPORT_ID)]: {...allReportActions?.[reportActionsKey(THREAD_REPORT_ID)], [threadComment.reportActionID]: threadComment},
        };
        const nextData = getSortedReportActionsData(nextReportActions, allReports, false);

        // Then the expense report, which shows its thread's actions combined with its own, includes the new comment
        expect(nextData.lastActions[EXPENSE_REPORT_ID]).toBe(threadComment);
    });

    it('should drop a report whose actions are removed', () => {
        // Given data built from a set of inputs
        const {allReportActions, allReports} = buildInputs();
        getSortedReportActionsData(allReportActions, allReports, false);

        // When the chat's actions are removed
        const nextReportActions = {...allReportActions};
        delete nextReportActions[reportActionsKey(CHAT_REPORT_ID)];
        const nextData = getSortedReportActionsData(nextReportActions, allReports, false);

        // Then the chat has no entry left
        expect(nextData.sortedActions[CHAT_REPORT_ID]).toBeUndefined();
        expect(nextData.lastActions[CHAT_REPORT_ID]).toBeUndefined();
        expect(CHAT_REPORT_ID in nextData.transactionThreadIDs).toBe(false);
    });

    it('should return the previous object when going offline does not change any transaction thread', () => {
        // Given data built while online
        const {allReportActions, allReports} = buildInputs();
        const data = getSortedReportActionsData(allReportActions, allReports, false);

        // When the app goes offline and no report has a pending deleted expense
        const nextData = getSortedReportActionsData(allReportActions, allReports, true);

        // Then nothing changed, so the same object comes back
        expect(nextData).toBe(data);
    });

    it('should drop the transaction thread when going offline with a second expense pending deletion', () => {
        // Given a one-transaction expense report with a second expense deleted while offline
        const {allReportActions, allReports} = buildInputs();
        const pendingDeleteIOUAction = createIOUAction(101, {
            childReportID: '41',
            created: '2024-01-01 09:00:00.000',
            pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
            message: [{type: 'COMMENT', html: '', text: ''}],
        });
        const reportActions = {
            ...allReportActions,
            [reportActionsKey(EXPENSE_REPORT_ID)]: {...allReportActions?.[reportActionsKey(EXPENSE_REPORT_ID)], [pendingDeleteIOUAction.reportActionID]: pendingDeleteIOUAction},
        };
        const onlineData = getSortedReportActionsData(reportActions, allReports, false);

        // When the app goes offline, which counts the pending-delete expense again
        const offlineData = getSortedReportActionsData(reportActions, allReports, true);

        // Then the report is no longer a one-transaction report, as computeForReport says
        expect(onlineData.transactionThreadIDs[EXPENSE_REPORT_ID]).toBe(THREAD_REPORT_ID);
        expect(offlineData.transactionThreadIDs[EXPENSE_REPORT_ID]).toBeUndefined();
    });
});

describe('useSortedReportActionsData', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        await act(async () => {
            await Onyx.clear();
        });
        await waitForBatchedUpdatesWithAct();
    });

    it('should apply a REPORT change that is batched with a REPORT_ACTIONS change for another report', async () => {
        // Given an expense report that is still a CHAT, so its one-transaction thread does not resolve yet
        await act(async () => {
            await Onyx.multiSet({
                [reportKey(CHAT_REPORT_ID)]: createMockReport({reportID: CHAT_REPORT_ID, type: CONST.REPORT.TYPE.CHAT}),
                [reportKey(EXPENSE_REPORT_ID)]: createMockReport({reportID: EXPENSE_REPORT_ID, type: CONST.REPORT.TYPE.CHAT, chatReportID: PARENT_CHAT_REPORT_ID}),
                [reportKey(PARENT_CHAT_REPORT_ID)]: createMockReport({reportID: PARENT_CHAT_REPORT_ID, type: CONST.REPORT.TYPE.CHAT}),
                [reportActionsKey(CHAT_REPORT_ID)]: toReportActions(createComment(1, '2024-01-01 09:00:00.000')),
                [reportActionsKey(EXPENSE_REPORT_ID)]: toReportActions(createIOUAction(100)),
                [reportActionsKey(THREAD_REPORT_ID)]: toReportActions(createComment(200, '2024-01-01 11:00:00.000')),
            });
        });
        await waitForBatchedUpdatesWithAct();
        const {result} = renderHook(() => useSortedReportActionsData());
        expect(result.current.transactionThreadIDs[EXPENSE_REPORT_ID]).toBeUndefined();

        // When one update flips the report to EXPENSE and adds a comment to a different report
        const updates: Array<OnyxUpdate<typeof ONYXKEYS.COLLECTION.REPORT | typeof ONYXKEYS.COLLECTION.REPORT_ACTIONS>> = [
            {onyxMethod: Onyx.METHOD.MERGE_COLLECTION, key: ONYXKEYS.COLLECTION.REPORT, value: {[reportKey(EXPENSE_REPORT_ID)]: {type: CONST.REPORT.TYPE.EXPENSE}}},
            {
                onyxMethod: Onyx.METHOD.MERGE_COLLECTION,
                key: ONYXKEYS.COLLECTION.REPORT_ACTIONS,
                value: {[reportActionsKey(CHAT_REPORT_ID)]: toReportActions(createComment(2, '2024-01-01 09:30:00.000'))},
            },
        ];
        await act(async () => {
            await Onyx.update(updates);
        });
        await waitForBatchedUpdatesWithAct();

        // Then the batched REPORT change is applied and the expense report's thread now resolves
        expect(result.current.transactionThreadIDs[EXPENSE_REPORT_ID]).toBe(THREAD_REPORT_ID);
        expect(result.current.lastActions[CHAT_REPORT_ID]?.reportActionID).toBe('2');
    });

    it('should not sort again when a NETWORK write leaves the offline state unchanged', async () => {
        // Given the hook mounted over some report actions
        await act(async () => {
            await Onyx.multiSet({
                [reportActionsKey(CHAT_REPORT_ID)]: toReportActions(createComment(1, '2024-01-01 09:00:00.000')),
                [reportActionsKey(EXPENSE_REPORT_ID)]: toReportActions(createIOUAction(100)),
            });
        });
        await waitForBatchedUpdatesWithAct();
        const {result} = renderHook(() => useSortedReportActionsData());
        const data = result.current;
        const sortSpy = jest.spyOn(ReportActionsUtils, 'getSortedReportActions');

        // When NETWORK changes a field that does not affect the offline state
        await act(async () => {
            await Onyx.merge(ONYXKEYS.NETWORK, {timeSkew: 5});
        });
        await waitForBatchedUpdatesWithAct();

        // Then no report is sorted again, where the derived value re-sorted every report, and the same object comes back
        expect(sortSpy).not.toHaveBeenCalled();
        expect(result.current).toBe(data);
        sortSpy.mockRestore();
    });
});
