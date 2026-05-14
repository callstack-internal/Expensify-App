import {renderHook} from '@testing-library/react-native';
import useStableReportForReportActionItem from '@hooks/useStableReportForReportActionItem';
import type {Report} from '@src/types/onyx';

function buildReport(overrides: Partial<Report> = {}): Report {
    return {
        reportID: 'r-1',
        type: 'chat',
        chatType: '' as Report['chatType'],
        policyID: 'p-1',
        ownerAccountID: 10,
        parentReportID: undefined,
        parentReportActionID: undefined,
        stateNum: 0,
        statusNum: 0,
        participants: {p10: {notificationPreference: 'always'}, p20: {notificationPreference: 'always'}},
        permissions: ['read', 'write'],
        reportName: 'Chat',
        description: '',
        total: 0,
        currency: 'USD',
        ...overrides,
    } as Report;
}

const EXPECTED_REPORT_KEYS = [
    'reportID',
    'chatReportID',
    'isWaitingOnBankAccount',
    'permissions',
    'policyID',
    'ownerAccountID',
    'parentReportID',
    'parentReportActionID',
    'type',
    'chatType',
    'stateNum',
    'statusNum',
    'isDeletedParentAction',
    'pendingFields',
    'participants',
    'errorFields',
    'reportName',
    'description',
    'managerID',
    'total',
    'nonReimbursableTotal',
    'policyAvatar',
    'fieldList',
    'iouReportID',
    'isCancelledIOU',
    'isOwnPolicyExpenseChat',
    'writeCapability',
    'currency',
    'visibility',
    'avatarUrl',
    'policyName',
    'transactionCount',
    'unheldTotal',
    'created',
].sort();

const ALLOW_LIST_CASES: Array<[string, unknown]> = [
    ['reportID', 'r-2'],
    ['chatReportID', 'chat-1'],
    ['isWaitingOnBankAccount', true],
    ['permissions', ['read']],
    ['policyID', 'p-2'],
    ['ownerAccountID', 99],
    ['parentReportID', 'parent-1'],
    ['parentReportActionID', 'pa-1'],
    ['type', 'iou'],
    ['chatType', 'policyAnnounce'],
    ['stateNum', 1],
    ['statusNum', 1],
    ['isDeletedParentAction', true],
    ['pendingFields', {reportName: 'add'}],
    ['participants', {p30: {notificationPreference: 'always'}}],
    ['errorFields', {currency: {foo: 'err'}}],
    ['reportName', 'Different name'],
    ['description', 'a desc'],
    ['managerID', 42],
    ['total', 1000],
    ['nonReimbursableTotal', 500],
    ['policyAvatar', 'avatar-url'],
    ['fieldList', {foo: 'bar'}],
    ['iouReportID', 'iou-1'],
    ['isCancelledIOU', true],
    ['isOwnPolicyExpenseChat', true],
    ['writeCapability', 'admins'],
    ['currency', 'EUR'],
    ['visibility', 'public'],
    ['avatarUrl', 'http://avatar'],
    ['policyName', 'Different policy'],
    ['transactionCount', 5],
    ['unheldTotal', 200],
    ['created', '2026-05-13 12:00:00'],
];

// Mirrors the "Never add" list in useStableReportForReportActionItem.ts: heartbeat-style fields
// that update on routine activity. These must not invalidate the memo or downstream re-renders cascade.
const DENY_LIST_CASES: Array<[string, unknown]> = [
    ['lastReadTime', '2026-05-13 12:00:00'],
    ['lastVisibleActionCreated', '2026-05-13 12:00:01'],
    ['lastVisibleActionLastModified', '2026-05-13 12:00:02'],
    ['lastMessageText', 'msg'],
    ['lastMessageHtml', '<p>msg</p>'],
    ['lastActorAccountID', 99],
    ['lastActionType', 'add'],
];

describe('useStableReportForReportActionItem', () => {
    it('returns undefined when reportID is missing on an otherwise populated blob', () => {
        const {result} = renderHook(({report}) => useStableReportForReportActionItem(report), {
            initialProps: {report: buildReport({reportID: undefined})},
        });
        expect(result.current).toBeUndefined();
    });

    it('projects only the documented allow-list keys', () => {
        const {result} = renderHook(({report}) => useStableReportForReportActionItem(report), {
            initialProps: {report: buildReport()},
        });
        expect(Object.keys(result.current ?? {}).sort()).toEqual(EXPECTED_REPORT_KEYS);
    });

    it.each(ALLOW_LIST_CASES)('flips the projection ref when `%s` changes', (field, nextValue) => {
        const initial = buildReport();
        const {result, rerender} = renderHook(({report}) => useStableReportForReportActionItem(report), {
            initialProps: {report: initial},
        });
        const firstRef = result.current;

        rerender({report: {...initial, [field]: nextValue} as Report});
        expect(result.current).not.toBe(firstRef);
    });

    it.each(DENY_LIST_CASES)('holds the projection ref when `%s` churns', (field, nextValue) => {
        const initial = buildReport();
        const {result, rerender} = renderHook(({report}) => useStableReportForReportActionItem(report), {
            initialProps: {report: initial},
        });
        const firstRef = result.current;

        rerender({report: {...initial, [field]: nextValue} as Report});
        expect(result.current).toBe(firstRef);
    });

    it('coerces managerID 0 to undefined and keeps the ref stable through the 0 -> undefined reconciliation', () => {
        // Backend ships managerID: 0 on chat reports without a manager; a later Onyx merge of
        // `{managerID: null}` deletes the key. Both must coerce to undefined for the memo to hold.
        const withZero = buildReport({managerID: 0});
        const {result, rerender} = renderHook(({report}) => useStableReportForReportActionItem(report), {
            initialProps: {report: withZero},
        });
        const firstRef = result.current;
        expect(firstRef?.managerID).toBeUndefined();

        rerender({report: {...withZero, managerID: undefined}});

        expect(result.current).toBe(firstRef);
        expect(result.current?.managerID).toBeUndefined();
    });

    it('keeps the projection ref stable when the upstream top-level ref flips but consumed primitives are unchanged', () => {
        const initial = buildReport();
        const {result, rerender} = renderHook(({report}) => useStableReportForReportActionItem(report), {
            initialProps: {report: initial},
        });
        const firstRef = result.current;

        rerender({report: {...initial} as Report});
        expect(result.current).toBe(firstRef);
    });

    it('holds the projection ref when `permissions` ref flips but contents are identical', () => {
        const initial = buildReport({permissions: ['read', 'write']});
        const {result, rerender} = renderHook(({report}) => useStableReportForReportActionItem(report), {
            initialProps: {report: initial},
        });
        const firstRef = result.current;

        rerender({report: {...initial, permissions: ['read', 'write']} as Report});
        expect(result.current).toBe(firstRef);
    });
});
