import {renderHook} from '@testing-library/react-native';
import useStableReportActionForReportActionItem from '@hooks/useStableReportActionForReportActionItem';
import {getOriginalMessage} from '@libs/ReportActionsUtils';
import CONST from '@src/CONST';
import type {ReportAction} from '@src/types/onyx';

function buildAction(overrides: Partial<ReportAction> = {}): ReportAction {
    return {
        reportActionID: 'a-1',
        actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
        created: '2026-05-13 12:00:00',
        actorAccountID: 10,
        message: [{type: 'COMMENT', html: 'hello', text: 'hello'}],
        originalMessage: {html: 'hello', whisperedTo: []},
        person: [{type: 'TEXT', style: 'strong', text: 'Tester'}],
        ...overrides,
    } as ReportAction;
}

const EXPECTED_ACTION_KEYS = [
    'reportActionID',
    'message',
    'pendingAction',
    'actionName',
    'errors',
    'originalMessage',
    'childCommenterCount',
    'linkMetadata',
    'childReportID',
    'childLastVisibleActionCreated',
    'error',
    'created',
    'actorAccountID',
    'adminAccountID',
    'childVisibleActionCount',
    'childOldestFourAccountIDs',
    'childType',
    'person',
    'isOptimisticAction',
    'delegateAccountID',
    'previousMessage',
    'isAttachmentWithText',
    'isOriginalReportDeleted',
    'childStateNum',
    'childStatusNum',
    'childReportName',
    'childManagerAccountID',
    'childMoneyRequestCount',
    'childOwnerAccountID',
].sort();

const ALLOW_LIST_CASES: Array<[string, unknown]> = [
    ['reportActionID', 'a-2'],
    ['message', [{type: 'COMMENT', html: 'world', text: 'world'}]],
    ['pendingAction', 'add'],
    ['actionName', CONST.REPORT.ACTIONS.TYPE.IOU],
    ['errors', {foo: 'err'}],
    ['originalMessage', {html: 'world', whisperedTo: []}],
    ['childCommenterCount', 5],
    ['linkMetadata', [{href: 'x'}]],
    ['childReportID', 'child-1'],
    ['childLastVisibleActionCreated', '2026-05-13 13:00:00'],
    ['error', 'oops'],
    ['created', '2026-05-13 14:00:00'],
    ['actorAccountID', 99],
    ['adminAccountID', 100],
    ['childVisibleActionCount', 3],
    ['childOldestFourAccountIDs', '1,2,3,4'],
    ['childType', 'chat'],
    ['person', [{type: 'TEXT', style: 'strong', text: 'Other'}]],
    ['isOptimisticAction', true],
    ['delegateAccountID', 42],
    ['previousMessage', [{type: 'COMMENT', html: 'prev', text: 'prev'}]],
    ['isAttachmentWithText', true],
    ['isOriginalReportDeleted', true],
    ['childStateNum', 1],
    ['childStatusNum', 1],
    ['childReportName', 'child report'],
    ['childManagerAccountID', 50],
    ['childMoneyRequestCount', 2],
    ['childOwnerAccountID', 60],
];

// Real ReportAction fields the hook deliberately omits from its projection (no descendant reads them).
// Churn on these must not invalidate the memo.
const DENY_LIST_CASES: Array<[string, unknown]> = [
    ['lastModified', '2026-05-13 12:00:01'],
    ['automatic', true],
    ['avatar', 'http://avatar'],
    ['shouldShow', false],
    ['isLoading', true],
    ['accountID', 99],
    ['whisperedTo', [1, 2]],
];

describe('useStableReportActionForReportActionItem', () => {
    it('projects only the documented allow-list keys', () => {
        const {result} = renderHook(({reportAction}) => useStableReportActionForReportActionItem(reportAction), {
            initialProps: {reportAction: buildAction()},
        });
        expect(Object.keys(result.current).sort()).toEqual(EXPECTED_ACTION_KEYS);
    });

    it.each(ALLOW_LIST_CASES)('flips the projection ref when `%s` changes', (field, nextValue) => {
        const initial = buildAction();
        const {result, rerender} = renderHook(({reportAction}) => useStableReportActionForReportActionItem(reportAction), {
            initialProps: {reportAction: initial},
        });
        const firstRef = result.current;

        rerender({reportAction: {...initial, [field]: nextValue} as ReportAction});
        expect(result.current).not.toBe(firstRef);
    });

    it.each(DENY_LIST_CASES)('holds the projection ref when `%s` churns', (field, nextValue) => {
        const initial = buildAction();
        const {result, rerender} = renderHook(({reportAction}) => useStableReportActionForReportActionItem(reportAction), {
            initialProps: {reportAction: initial},
        });
        const firstRef = result.current;

        rerender({reportAction: {...initial, [field]: nextValue} as ReportAction});
        expect(result.current).toBe(firstRef);
    });

    it('precomputes originalMessage on the projection', () => {
        const {result} = renderHook(({reportAction}) => useStableReportActionForReportActionItem(reportAction), {
            initialProps: {reportAction: buildAction()},
        });
        expect(getOriginalMessage(result.current)).toEqual({html: 'hello', whisperedTo: []});
    });

    it('keeps the projection ref stable when the upstream top-level ref flips but consumed fields are unchanged', () => {
        const initial = buildAction();
        const {result, rerender} = renderHook(({reportAction}) => useStableReportActionForReportActionItem(reportAction), {
            initialProps: {reportAction: initial},
        });
        const firstRef = result.current;

        rerender({reportAction: {...initial} as ReportAction});
        expect(result.current).toBe(firstRef);
    });
});
