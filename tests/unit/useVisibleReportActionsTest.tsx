/* eslint-disable @typescript-eslint/naming-convention */
import {act, renderHook} from '@testing-library/react-native';

import useVisibleReportActions from '@hooks/useVisibleReportActions';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportAction} from '@src/types/onyx';

import type * as VisibleReportActionsSelectors from '@selectors/VisibleReportActions';

import {getVisibleReportActionsForReports} from '@selectors/VisibleReportActions';
import Onyx from 'react-native-onyx';

import {getFakeReportAction} from '../utils/ReportTestUtils';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

jest.mock('@selectors/VisibleReportActions', () => {
    const actual = jest.requireActual<typeof VisibleReportActionsSelectors>('@selectors/VisibleReportActions');
    return {...actual, getVisibleReportActionsForReports: jest.fn(actual.getVisibleReportActionsForReports)};
});

const REPORT_ID = '1';
const TRANSACTION_THREAD_REPORT_ID = '2';
const OTHER_REPORT_ID = '3';
const CURRENT_USER_ACCOUNT_ID = 10;
const OTHER_USER_ACCOUNT_ID = 20;

const selectorMock = jest.mocked(getVisibleReportActionsForReports);

function createComment(reportActionID: number, reportID: string): ReportAction {
    return getFakeReportAction(reportActionID, {reportID, actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT});
}

function createWhisper(reportActionID: number, reportID: string, whisperedToAccountID: number): ReportAction {
    return getFakeReportAction(reportActionID, {
        reportID,
        actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
        message: [{html: 'whisper', text: 'whisper', type: 'COMMENT', whisperedTo: [whisperedToAccountID]}],
        originalMessage: {html: 'whisper', whisperedTo: [whisperedToAccountID]},
    });
}

async function setReportActions(reportID: string, actions: ReportAction[]) {
    await act(async () => {
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`, Object.fromEntries(actions.map((action) => [action.reportActionID, action])));
    });
    await waitForBatchedUpdatesWithAct();
}

async function mergeReportAction(reportID: string, action: ReportAction) {
    await act(async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`, {[action.reportActionID]: action});
    });
    await waitForBatchedUpdatesWithAct();
}

describe('useVisibleReportActions', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        selectorMock.mockClear();
        await act(async () => {
            await Onyx.clear();
            await Onyx.set(ONYXKEYS.SESSION, {accountID: CURRENT_USER_ACCOUNT_ID});
        });
        await waitForBatchedUpdatesWithAct();
    });

    it('should re-run only when its own report actions change', async () => {
        // Given a report and another report, each with one comment, and the hook mounted for the first one
        await setReportActions(REPORT_ID, [createComment(1, REPORT_ID)]);
        await setReportActions(OTHER_REPORT_ID, [createComment(2, OTHER_REPORT_ID)]);
        const {result} = renderHook(() => useVisibleReportActions(REPORT_ID));
        await waitForBatchedUpdatesWithAct();
        const visibilityBeforeWrites = result.current;
        const runsBeforeWrites = selectorMock.mock.calls.length;
        expect(visibilityBeforeWrites).toEqual({[REPORT_ID]: {'1': true}});

        // When a comment is added to the other report, which is a write to another member of the same collection
        await mergeReportAction(OTHER_REPORT_ID, createComment(3, OTHER_REPORT_ID));

        // Then the selector doesn't run at all, because the hook depends on its report's member key, not the whole collection
        expect(selectorMock.mock.calls.length).toBe(runsBeforeWrites);
        expect(result.current).toBe(visibilityBeforeWrites);

        // When a comment is added to the hook's own report
        await mergeReportAction(REPORT_ID, createComment(4, REPORT_ID));

        // Then the selector runs and the new action shows up
        expect(selectorMock.mock.calls.length).toBeGreaterThan(runsBeforeWrites);
        expect(result.current).toEqual({[REPORT_ID]: {'1': true, '4': true}});
    });

    it('should follow the transaction thread when one is given', async () => {
        // Given a report with a transaction thread, as an LHN row of a one-transaction report sees it
        await setReportActions(REPORT_ID, [createComment(1, REPORT_ID)]);
        await setReportActions(TRANSACTION_THREAD_REPORT_ID, [createComment(2, TRANSACTION_THREAD_REPORT_ID)]);
        const {result} = renderHook(() => useVisibleReportActions(REPORT_ID, TRANSACTION_THREAD_REPORT_ID));
        await waitForBatchedUpdatesWithAct();
        expect(result.current).toEqual({[REPORT_ID]: {'1': true}, [TRANSACTION_THREAD_REPORT_ID]: {'2': true}});

        // When a comment is added to the transaction thread only
        await mergeReportAction(TRANSACTION_THREAD_REPORT_ID, createComment(3, TRANSACTION_THREAD_REPORT_ID));

        // Then the row sees it, since the thread's member key is a dependency too
        expect(result.current?.[TRANSACTION_THREAD_REPORT_ID]).toEqual({'2': true, '3': true});
    });

    it('should recompute when the session user changes', async () => {
        // Given a whisper to the current user
        await setReportActions(REPORT_ID, [createWhisper(1, REPORT_ID, CURRENT_USER_ACCOUNT_ID)]);
        const {result} = renderHook(() => useVisibleReportActions(REPORT_ID));
        await waitForBatchedUpdatesWithAct();
        expect(result.current?.[REPORT_ID]?.['1']).toBe(true);

        // When another user signs in, which changes whisper targeting while the report actions stay the same
        await act(async () => {
            await Onyx.set(ONYXKEYS.SESSION, {accountID: OTHER_USER_ACCOUNT_ID});
        });
        await waitForBatchedUpdatesWithAct();

        // Then the whisper is hidden, so a cached result for the previous user is not reused
        expect(result.current?.[REPORT_ID]?.['1']).toBe(false);
    });

    it('should drop a deleted action', async () => {
        // Given a report with two visible comments
        await setReportActions(REPORT_ID, [createComment(1, REPORT_ID), createComment(2, REPORT_ID)]);
        const {result} = renderHook(() => useVisibleReportActions(REPORT_ID));
        await waitForBatchedUpdatesWithAct();
        expect(result.current).toEqual({[REPORT_ID]: {'1': true, '2': true}});

        // When one comment is deleted with a null tombstone merge, which is how report action deletion works
        await act(async () => {
            await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`, {'1': null});
        });
        await waitForBatchedUpdatesWithAct();

        // Then the deleted action is gone instead of left stale, because the report is rebuilt from its current actions
        expect(result.current).toEqual({[REPORT_ID]: {'2': true}});
    });

    it('should return undefined when the report has no actions', async () => {
        // Given no report actions at all

        // When the hook is mounted for a report
        const {result} = renderHook(() => useVisibleReportActions(REPORT_ID));
        await waitForBatchedUpdatesWithAct();

        // Then it returns undefined, so isReportActionVisible falls back to the runtime check as it did without a derived entry
        expect(result.current).toBeUndefined();
    });
});
