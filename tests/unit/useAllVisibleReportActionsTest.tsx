/* eslint-disable @typescript-eslint/naming-convention */
import {act, renderHook} from '@testing-library/react-native';

import useAllVisibleReportActions from '@hooks/useAllVisibleReportActions';

import {isReportActionVisible} from '@libs/ReportActionsUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportAction} from '@src/types/onyx';

import Onyx from 'react-native-onyx';

import {getFakeReportAction} from '../utils/ReportTestUtils';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

const REPORT_ID = '1';
const OTHER_REPORT_ID = '3';

function createComment(reportActionID: number, reportID: string): ReportAction {
    return getFakeReportAction(reportActionID, {reportID, actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT});
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

/** Mounts the hook for one read, so every read goes through the module memo the way a newly opened Search surface does */
async function getVisibleReportActions() {
    const {result, unmount} = renderHook(() => useAllVisibleReportActions());
    await waitForBatchedUpdatesWithAct();
    const visibleReportActions = result.current;
    unmount();
    return visibleReportActions;
}

describe('useAllVisibleReportActions', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        await Onyx.clear();
    });

    it.each([
        CONST.REPORT.ACTIONS.TYPE.REIMBURSEMENT_DEQUEUED,
        CONST.REPORT.ACTIONS.TYPE.REIMBURSEMENT_ACH_CANCELED,
        CONST.REPORT.ACTIONS.TYPE.REIMBURSEMENT_ACH_BOUNCE,
        CONST.REPORT.ACTIONS.TYPE.RETRACTED,
        CONST.REPORT.ACTIONS.TYPE.REOPENED,
        CONST.REPORT.ACTIONS.TYPE.UNAPPROVED,
    ])('should keep a later reimbursement visible after %s even when the earlier PAY was cached', async (actionName) => {
        // Given a report whose MARKED_REIMBURSED is hidden by its PAY
        const reportID = `reportWithHistoricalPay-${actionName}`;
        const reportActionsKey = `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}` as const;
        const markedReimbursed = getFakeReportAction(1, {
            reportID,
            actionName: CONST.REPORT.ACTIONS.TYPE.MARKED_REIMBURSED,
            created: '2025-01-01 00:00:00.000',
            originalMessage: {},
        });
        const pay = getFakeReportAction(2, {
            reportID,
            actionName: CONST.REPORT.ACTIONS.TYPE.IOU,
            created: '2025-01-01 00:00:01.000',
            originalMessage: {type: CONST.IOU.REPORT_ACTION_TYPE.PAY, IOUReportID: reportID, amount: 100, currency: CONST.CURRENCY.USD},
        });
        await Onyx.set(reportActionsKey, {[markedReimbursed.reportActionID]: markedReimbursed, [pay.reportActionID]: pay});
        await waitForBatchedUpdates();
        const initialVisibility = await getVisibleReportActions();
        expect(isReportActionVisible(markedReimbursed, reportID, true, initialVisibility)).toBe(false);

        // When a later reimbursement arrives before the action that cancels the first payment, as history can arrive out of order
        const cancellation = getFakeReportAction(3, {reportID, actionName, created: '2025-01-02 00:00:00.000'});
        const laterReimbursement = {...markedReimbursed, reportActionID: '4', created: '2025-01-03 00:00:00.000'};
        await Onyx.mergeCollection(ONYXKEYS.COLLECTION.REPORT_ACTIONS, {[reportActionsKey]: {[laterReimbursement.reportActionID]: laterReimbursement}});
        await waitForBatchedUpdates();
        const incompleteVisibility = await getVisibleReportActions();

        // Then the earlier payment still appears to cover it
        expect(isReportActionVisible(laterReimbursement, reportID, true, incompleteVisibility)).toBe(false);

        // When the cancellation arrives
        await Onyx.mergeCollection(ONYXKEYS.COLLECTION.REPORT_ACTIONS, {[reportActionsKey]: {[cancellation.reportActionID]: cancellation}});
        await waitForBatchedUpdates();
        const updatedVisibility = await getVisibleReportActions();

        // Then the later reimbursement shows and the earlier one stays hidden, so no stale cached entry survives
        expect(isReportActionVisible(laterReimbursement, reportID, true, updatedVisibility)).toBe(true);
        expect(isReportActionVisible(markedReimbursed, reportID, true, updatedVisibility)).toBe(false);

        // When a PAY of the new payment attempt arrives later
        const laterPay = {...pay, reportActionID: '5', created: '2025-01-03 00:00:01.000'};
        await Onyx.mergeCollection(ONYXKEYS.COLLECTION.REPORT_ACTIONS, {[reportActionsKey]: {[laterPay.reportActionID]: laterPay}});
        await waitForBatchedUpdates();
        const finalVisibility = await getVisibleReportActions();

        // Then it hides its duplicate reimbursement
        expect(isReportActionVisible(laterReimbursement, reportID, true, finalVisibility)).toBe(false);
    });

    it.each([CONST.REPORT.ACTIONS.TYPE.RETRACTED, CONST.REPORT.ACTIONS.TYPE.REOPENED, CONST.REPORT.ACTIONS.TYPE.UNAPPROVED])(
        'should not retroactively hide a standalone reimbursement when PAY arrives after %s',
        async (actionName) => {
            // Given a report with a standalone MARKED_REIMBURSED, which is visible
            const reportID = `reportWithFuturePay-${actionName}`;
            const reportActionsKey = `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}` as const;
            const markedReimbursed = getFakeReportAction(1, {
                actionName: CONST.REPORT.ACTIONS.TYPE.MARKED_REIMBURSED,
                created: '2025-01-01 00:00:00.000',
                originalMessage: {},
            });
            await Onyx.set(reportActionsKey, {[markedReimbursed.reportActionID]: markedReimbursed});
            await waitForBatchedUpdates();
            const initialVisibility = await getVisibleReportActions();
            expect(isReportActionVisible(markedReimbursed, reportID, true, initialVisibility)).toBe(true);

            // When a boundary action, a PAY and a later reimbursement arrive together
            const boundary = getFakeReportAction(2, {actionName, created: '2025-02-01 00:00:00.000'});
            const pay = getFakeReportAction(3, {
                actionName: CONST.REPORT.ACTIONS.TYPE.IOU,
                created: '2025-06-01 00:00:00.000',
                originalMessage: {type: CONST.IOU.REPORT_ACTION_TYPE.PAY, IOUReportID: reportID, amount: 100, currency: CONST.CURRENCY.USD},
            });
            const laterReimbursement = {...markedReimbursed, reportActionID: '4', created: '2025-06-01 00:00:01.000'};
            await Onyx.mergeCollection(ONYXKEYS.COLLECTION.REPORT_ACTIONS, {
                [reportActionsKey]: {[boundary.reportActionID]: boundary, [pay.reportActionID]: pay, [laterReimbursement.reportActionID]: laterReimbursement},
            });
            await waitForBatchedUpdates();
            const updatedVisibility = await getVisibleReportActions();

            // Then only the reimbursement after the boundary is hidden by the PAY
            expect(isReportActionVisible(markedReimbursed, reportID, true, updatedVisibility)).toBe(true);
            expect(isReportActionVisible(laterReimbursement, reportID, true, updatedVisibility)).toBe(false);
        },
    );

    it('should use the collection reportID to hide MARKED_REIMBURSED when its sibling PAY arrives later', async () => {
        // Given a report with a MARKED_REIMBURSED and no PAY yet
        const reportID = 'reportWithLatePaySibling';
        const reportActionsKey = `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}` as const;
        const markedReimbursedAction: ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.MARKED_REIMBURSED> = {
            actionName: CONST.REPORT.ACTIONS.TYPE.MARKED_REIMBURSED,
            reportActionID: '1',
            created: '2025-01-01 00:00:00',
            message: [{type: 'TEXT', style: 'normal', text: 'Marked as reimbursed'}],
            originalMessage: {},
        };
        const payAction = {
            actionName: CONST.REPORT.ACTIONS.TYPE.IOU,
            reportActionID: '2',
            created: '2025-01-01 00:00:01',
            message: [{type: 'TEXT', style: 'normal', text: 'paid'}],
            originalMessage: {type: CONST.IOU.REPORT_ACTION_TYPE.PAY, IOUReportID: reportID, amount: 100, currency: CONST.CURRENCY.USD},
        } as ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.IOU>;
        await Onyx.set(reportActionsKey, {[markedReimbursedAction.reportActionID]: markedReimbursedAction});
        await waitForBatchedUpdates();
        const initialVisibility = await getVisibleReportActions();
        expect(initialVisibility[reportID]).toBeDefined();
        expect(isReportActionVisible(markedReimbursedAction, reportID, true, initialVisibility)).toBe(true);

        // When only the PAY arrives
        await Onyx.mergeCollection(ONYXKEYS.COLLECTION.REPORT_ACTIONS, {[reportActionsKey]: {[payAction.reportActionID]: payAction}});
        await waitForBatchedUpdates();
        const updatedVisibility = await getVisibleReportActions();

        // Then the cached visibility doesn't keep a stale result for its sibling, which is now hidden on every path
        expect(updatedVisibility[reportID]?.[payAction.reportActionID]).toBe(true);
        expect(isReportActionVisible(markedReimbursedAction, reportID, true, updatedVisibility)).toBe(false);
        expect(isReportActionVisible(markedReimbursedAction, reportID, true)).toBe(false);
        expect(isReportActionVisible(markedReimbursedAction, reportID, true, {})).toBe(false);
        expect(isReportActionVisible({...markedReimbursedAction, pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD}, reportID, true, updatedVisibility)).toBe(false);
    });

    it('should keep the previous map and the untouched reports when a write leaves visibility unchanged', async () => {
        // Given two reports with a comment each
        const comment = createComment(1, REPORT_ID);
        await setReportActions(REPORT_ID, [comment]);
        await setReportActions(OTHER_REPORT_ID, [createComment(2, OTHER_REPORT_ID)]);
        let renderCount = 0;
        const {result} = renderHook(() => {
            renderCount++;
            return useAllVisibleReportActions();
        });
        await waitForBatchedUpdatesWithAct();
        const mapBeforeWrite = result.current;
        const renderCountBeforeWrite = renderCount;
        expect(mapBeforeWrite).toEqual({[REPORT_ID]: {'1': true}, [OTHER_REPORT_ID]: {'2': true}});

        // When the comment is edited, which gives the report's actions a new object but leaves every action visible
        await mergeReportAction(REPORT_ID, {...comment, lastModified: '2025-01-01 00:00:00.000'});

        // Then the hook returns the same map object and doesn't re-render, so Search consumers keep their memoized work
        expect(result.current).toBe(mapBeforeWrite);
        expect(renderCount).toBe(renderCountBeforeWrite);

        // When a comment is added to the first report
        await mergeReportAction(REPORT_ID, createComment(3, REPORT_ID));

        // Then the map changes and the other report keeps its object
        expect(result.current).toEqual({[REPORT_ID]: {'1': true, '3': true}, [OTHER_REPORT_ID]: {'2': true}});
        expect(result.current[OTHER_REPORT_ID]).toBe(mapBeforeWrite[OTHER_REPORT_ID]);
    });

    it('should drop a report whose actions are removed', async () => {
        // Given two reports with a comment each
        await setReportActions(REPORT_ID, [createComment(1, REPORT_ID)]);
        await setReportActions(OTHER_REPORT_ID, [createComment(2, OTHER_REPORT_ID)]);
        const {result} = renderHook(() => useAllVisibleReportActions());
        await waitForBatchedUpdatesWithAct();

        // When the actions of one report are removed entirely
        await act(async () => {
            await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${OTHER_REPORT_ID}`, null);
        });
        await waitForBatchedUpdatesWithAct();

        // Then the report leaves the map, as it left the derived value
        expect(result.current).toEqual({[REPORT_ID]: {'1': true}});
    });
});
