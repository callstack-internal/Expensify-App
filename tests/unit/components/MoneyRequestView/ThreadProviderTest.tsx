import {renderHook} from '@testing-library/react-native';
import React from 'react';
import LiveTransactionProvider from '@components/MoneyRequestView/contexts/LiveTransactionProvider';
import ThreadProvider, {useFieldEditPermission, useParentReportID, useTransactionThreadReport} from '@components/MoneyRequestView/contexts/ThreadProvider';
import useOnyx from '@hooks/useOnyx';
import useReportIsArchived from '@hooks/useReportIsArchived';
import * as ReportUtils from '@libs/ReportUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Policy, Report, ReportAction, Transaction} from '@src/types/onyx';

jest.mock('@hooks/useOnyx', () => jest.fn());
const mockUseOnyx = useOnyx as jest.MockedFunction<typeof useOnyx>;

jest.mock('@hooks/useReportIsArchived', () => jest.fn(() => false));
const mockUseReportIsArchived = useReportIsArchived as jest.MockedFunction<typeof useReportIsArchived>;

jest.mock('@components/Search/SearchContext', () => ({
    useSearchStateContext: () => ({currentSearchResults: undefined}),
    SearchStateContext: {Provider: ({children}: {children: React.ReactNode}) => children},
}));

const PARENT_REPORT_ID = 'parent-1';
const THREAD_REPORT_ID = 'thread-1';
const POLICY_ID = 'policy-1';
const PARENT_ACTION_ID = 'action-1';
const TRANSACTION_ID = 'txn-1';

function makeOpenReport(): Report {
    return {
        reportID: PARENT_REPORT_ID,
        policyID: POLICY_ID,
        chatReportID: 'chat-1',
        type: CONST.REPORT.TYPE.EXPENSE,
        stateNum: CONST.REPORT.STATE_NUM.OPEN,
        statusNum: CONST.REPORT.STATUS_NUM.OPEN,
        managerID: 999,
    } as Report;
}

function makeSettledReport(): Report {
    return {
        ...makeOpenReport(),
        stateNum: CONST.REPORT.STATE_NUM.APPROVED,
        statusNum: CONST.REPORT.STATUS_NUM.REIMBURSED,
    } as Report;
}

function makeThreadReport(): Report {
    return {
        reportID: THREAD_REPORT_ID,
        parentReportID: PARENT_REPORT_ID,
        parentReportActionID: PARENT_ACTION_ID,
    } as Report;
}

function makePolicy(role: 'admin' | 'user' = 'admin'): Policy {
    return {
        id: POLICY_ID,
        role,
        type: CONST.POLICY.TYPE.TEAM,
    } as Policy;
}

function makeParentAction(): ReportAction {
    return {
        reportActionID: PARENT_ACTION_ID,
        actionName: CONST.REPORT.ACTIONS.TYPE.IOU,
        originalMessage: {
            type: CONST.IOU.REPORT_ACTION_TYPE.CREATE,
            IOUTransactionID: TRANSACTION_ID,
            IOUReportID: PARENT_REPORT_ID,
        },
        actorAccountID: 1,
    } as unknown as ReportAction;
}

function makeTransaction(): Transaction {
    return {
        transactionID: TRANSACTION_ID,
        reportID: PARENT_REPORT_ID,
        amount: 1000,
        currency: 'USD',
    } as Transaction;
}

function setupOnyx(overrides: Record<string, unknown>) {
    mockUseOnyx.mockImplementation(((key: string, options?: {selector?: (data: unknown) => unknown}) => {
        const raw = key in overrides ? overrides[key] : undefined;
        const value = options?.selector ? options.selector(raw) : raw;
        return [value, {status: 'loaded'}];
    }) as typeof useOnyx);
}

function wrap() {
    function Wrapper({children}: {children: React.ReactNode}) {
        return (
            <LiveTransactionProvider
                transactionID={TRANSACTION_ID}
                policyID={POLICY_ID}
            >
                <ThreadProvider
                    parentReportID={PARENT_REPORT_ID}
                    transactionThreadReportID={THREAD_REPORT_ID}
                    policyID={POLICY_ID}
                >
                    {children}
                </ThreadProvider>
            </LiveTransactionProvider>
        );
    }
    return Wrapper;
}

describe('ThreadProvider', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseReportIsArchived.mockReturnValue(false);
    });

    it('throws when hook called outside provider', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => renderHook(() => useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.AMOUNT))).toThrow('ThreadProvider missing');
        consoleError.mockRestore();
    });

    it('exposes parentReportID and thread report', () => {
        const parentReport = makeOpenReport();
        const threadReport = makeThreadReport();
        const policy = makePolicy('admin');
        const action = makeParentAction();
        const transaction = makeTransaction();

        setupOnyx({
            [`${ONYXKEYS.COLLECTION.REPORT}${PARENT_REPORT_ID}`]: parentReport,
            [`${ONYXKEYS.COLLECTION.REPORT}${THREAD_REPORT_ID}`]: threadReport,
            [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${PARENT_REPORT_ID}`]: {[PARENT_ACTION_ID]: action},
            [`${ONYXKEYS.COLLECTION.POLICY}${POLICY_ID}`]: policy,
            [`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: transaction,
        });

        const {result} = renderHook(
            () => ({
                parentID: useParentReportID(),
                report: useTransactionThreadReport(),
            }),
            {wrapper: wrap()},
        );

        expect(result.current.parentID).toBe(PARENT_REPORT_ID);
        expect(result.current.report?.reportID).toBe(THREAD_REPORT_ID);
    });

    it('returns true permissions on open report for admin on editable fields', () => {
        const parentReport = makeOpenReport();
        const threadReport = makeThreadReport();
        const policy = makePolicy('admin');
        const action = makeParentAction();
        const transaction = makeTransaction();

        setupOnyx({
            [`${ONYXKEYS.COLLECTION.REPORT}${PARENT_REPORT_ID}`]: parentReport,
            [`${ONYXKEYS.COLLECTION.REPORT}${THREAD_REPORT_ID}`]: threadReport,
            [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${PARENT_REPORT_ID}`]: {[PARENT_ACTION_ID]: action},
            [`${ONYXKEYS.COLLECTION.POLICY}${POLICY_ID}`]: policy,
            [`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: transaction,
        });

        const spy = jest.spyOn(ReportUtils, 'canEditFieldOfMoneyRequest').mockReturnValue(true);
        jest.spyOn(ReportUtils, 'canUserPerformWriteAction').mockReturnValue(true);
        jest.spyOn(ReportUtils, 'canEditMoneyRequest').mockReturnValue(true);

        const {result} = renderHook(() => useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.AMOUNT), {
            wrapper: wrap(),
        });

        expect(result.current).toBe(true);
        spy.mockRestore();
    });

    it('returns false for all fields when report is not writable (settled)', () => {
        const parentReport = makeSettledReport();
        const threadReport = makeThreadReport();
        const policy = makePolicy('admin');
        const action = makeParentAction();
        const transaction = makeTransaction();

        setupOnyx({
            [`${ONYXKEYS.COLLECTION.REPORT}${PARENT_REPORT_ID}`]: parentReport,
            [`${ONYXKEYS.COLLECTION.REPORT}${THREAD_REPORT_ID}`]: threadReport,
            [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${PARENT_REPORT_ID}`]: {[PARENT_ACTION_ID]: action},
            [`${ONYXKEYS.COLLECTION.POLICY}${POLICY_ID}`]: policy,
            [`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: transaction,
        });

        jest.spyOn(ReportUtils, 'canUserPerformWriteAction').mockReturnValue(false);

        const {result} = renderHook(
            () => ({
                amount: useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.AMOUNT),
                merchant: useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.MERCHANT),
                date: useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.DATE),
            }),
            {wrapper: wrap()},
        );

        expect(result.current.amount).toBe(false);
        expect(result.current.merchant).toBe(false);
        expect(result.current.date).toBe(false);
    });

    it('returns scalar boolean (not object/array)', () => {
        const parentReport = makeOpenReport();
        const threadReport = makeThreadReport();
        const policy = makePolicy('admin');
        const action = makeParentAction();
        const transaction = makeTransaction();

        setupOnyx({
            [`${ONYXKEYS.COLLECTION.REPORT}${PARENT_REPORT_ID}`]: parentReport,
            [`${ONYXKEYS.COLLECTION.REPORT}${THREAD_REPORT_ID}`]: threadReport,
            [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${PARENT_REPORT_ID}`]: {[PARENT_ACTION_ID]: action},
            [`${ONYXKEYS.COLLECTION.POLICY}${POLICY_ID}`]: policy,
            [`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`]: transaction,
        });

        jest.spyOn(ReportUtils, 'canUserPerformWriteAction').mockReturnValue(true);
        jest.spyOn(ReportUtils, 'canEditFieldOfMoneyRequest').mockReturnValue(true);

        const {result} = renderHook(() => useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.CATEGORY), {
            wrapper: wrap(),
        });

        expect(typeof result.current).toBe('boolean');
    });
});
