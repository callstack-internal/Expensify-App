import {renderHook} from '@testing-library/react-native';

import {SearchQueryContext} from '@components/Search/SearchContext';
import {SearchScopeProvider} from '@components/Search/SearchScopeProvider';
import type {SearchQueryContextValue} from '@components/Search/types';

import {useAllReportAttributes, useIsEmptyReport, useReportName, useReportNames, useReportStatus} from '@hooks/useReportAttributes';

import {flushReportAttributesSnapshot} from '@libs/ReportAttributesCache';

import CONST from '@src/CONST';
import IntlStore from '@src/languages/IntlStore';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Policy, Report, Transaction} from '@src/types/onyx';

import type {PropsWithChildren} from 'react';

import Onyx from 'react-native-onyx';

import createMock from '../utils/createMock';
import getOnyxValue from '../utils/getOnyxValue';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

const CURRENT_USER_ACCOUNT_ID = 1;
const POLICY_ID = 'P1';
const WORKSPACE_CHAT_ID = '10';
const EXPENSE_REPORT_ID = '11';
const DM_ID = '12';
const TRANSACTION_ID = '50';
const SEARCH_HASH = 12345;
const OTHER_ACCOUNT_ID = 2;

const policy = {
    id: POLICY_ID,
    name: 'Workspace',
    type: CONST.POLICY.TYPE.TEAM,
    role: CONST.POLICY.ROLE.ADMIN,
    owner: 'owner@test.com',
    outputCurrency: CONST.CURRENCY.USD,
    approvalMode: CONST.POLICY.APPROVAL_MODE.BASIC,
} as Policy;

const workspaceChat: Report = {
    reportID: WORKSPACE_CHAT_ID,
    type: CONST.REPORT.TYPE.CHAT,
    chatType: CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT,
    policyID: POLICY_ID,
    ownerAccountID: CURRENT_USER_ACCOUNT_ID,
    isOwnPolicyExpenseChat: true,
    participants: {[CURRENT_USER_ACCOUNT_ID]: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS}},
};

const expenseReport: Report = {
    reportID: EXPENSE_REPORT_ID,
    type: CONST.REPORT.TYPE.EXPENSE,
    chatReportID: WORKSPACE_CHAT_ID,
    parentReportID: WORKSPACE_CHAT_ID,
    policyID: POLICY_ID,
    ownerAccountID: CURRENT_USER_ACCOUNT_ID,
    managerID: CURRENT_USER_ACCOUNT_ID,
    stateNum: CONST.REPORT.STATE_NUM.OPEN,
    statusNum: CONST.REPORT.STATUS_NUM.OPEN,
    total: -1000,
    currency: CONST.CURRENCY.USD,
};

const dm: Report = {
    reportID: DM_ID,
    type: CONST.REPORT.TYPE.CHAT,
    participants: {
        [CURRENT_USER_ACCOUNT_ID]: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
        [OTHER_ACCOUNT_ID]: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
    },
};

const transaction = {transactionID: TRANSACTION_ID, reportID: EXPENSE_REPORT_ID, amount: -100, currency: CONST.CURRENCY.USD, merchant: 'Coffee', created: '2024-01-01'} as Transaction;

async function seedAccount() {
    await Onyx.multiSet({
        [ONYXKEYS.SESSION]: {accountID: CURRENT_USER_ACCOUNT_ID, email: 'user1@test.com'},
        [ONYXKEYS.PERSONAL_DETAILS_LIST]: {
            [CURRENT_USER_ACCOUNT_ID]: {accountID: CURRENT_USER_ACCOUNT_ID, login: 'user1@test.com', displayName: 'User One'},
            [OTHER_ACCOUNT_ID]: {accountID: OTHER_ACCOUNT_ID, login: 'user2@test.com', displayName: 'User Two'},
        },
        [`${ONYXKEYS.COLLECTION.POLICY}${POLICY_ID}` as const]: policy,
        [`${ONYXKEYS.COLLECTION.REPORT}${WORKSPACE_CHAT_ID}` as const]: workspaceChat,
        [`${ONYXKEYS.COLLECTION.REPORT}${EXPENSE_REPORT_ID}` as const]: expenseReport,
        [`${ONYXKEYS.COLLECTION.REPORT}${DM_ID}` as const]: dm,
        [`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}` as const]: transaction,
    });
    await waitForBatchedUpdatesWithAct();
}

describe('useAllReportAttributes', () => {
    beforeAll(async () => {
        Onyx.init({keys: ONYXKEYS});
        await IntlStore.load(CONST.LOCALES.EN);
        await Onyx.set(ONYXKEYS.RAM_ONLY_ARE_TRANSLATIONS_LOADING, false);
    });

    beforeEach(async () => {
        await seedAccount();
    });

    afterEach(async () => {
        await Onyx.clear();
        await IntlStore.load(CONST.LOCALES.EN);
        await waitForBatchedUpdatesWithAct();
    });

    it('should keep the same reference when a dependency changes without touching any report', async () => {
        // Given the attributes of the seeded account
        const {result} = renderHook(() => useAllReportAttributes());
        await waitForBatchedUpdatesWithAct();
        const initialAttributes = result.current;
        expect(initialAttributes[DM_ID]?.reportName).toBe('User Two');

        // When a personal detail changes in a field no report name reads
        await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {[OTHER_ACCOUNT_ID]: {avatar: 'https://example.com/avatar.png'}});
        await waitForBatchedUpdatesWithAct();

        // Then consumers get the same map back, so they don't re-render
        expect(result.current).toBe(initialAttributes);
    });

    it('should mark the workspace chat with an error when an expense on it gets a violation', async () => {
        // Given a workspace chat with an open expense report and no violations
        const {result} = renderHook(() => useAllReportAttributes());
        await waitForBatchedUpdatesWithAct();
        expect(result.current[WORKSPACE_CHAT_ID]?.brickRoadStatus).toBeUndefined();

        // When the expense on that report gets a violation the submitter has to fix
        await Onyx.set(`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${TRANSACTION_ID}`, [
            {name: CONST.VIOLATIONS.AUTO_REPORTED_REJECTED_EXPENSE, type: CONST.VIOLATION_TYPES.VIOLATION, showInReview: true},
        ]);
        await waitForBatchedUpdatesWithAct();

        // Then the workspace chat shows the RBR with a Fix badge
        expect(result.current[WORKSPACE_CHAT_ID]?.brickRoadStatus).toBe(CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR);
        expect(result.current[WORKSPACE_CHAT_ID]?.actionBadge).toBe(CONST.REPORT.ACTION_BADGE.FIX);
    });

    it('should rename every report when the locale changes', async () => {
        // Given an expense report whose name is built from translated copy
        const {result} = renderHook(() => useAllReportAttributes());
        await waitForBatchedUpdatesWithAct();
        const englishName = result.current[EXPENSE_REPORT_ID]?.reportName;

        // When the user switches to Spanish and its translations finish loading
        await IntlStore.load(CONST.LOCALES.ES);
        await waitForBatchedUpdatesWithAct();

        // Then the name is rebuilt in Spanish
        expect(result.current[EXPENSE_REPORT_ID]?.reportName).not.toBe(englishName);
        expect(result.current[EXPENSE_REPORT_ID]?.reportName).toContain('US$');
    });

    it('should drop the reports of the previous session when Onyx is cleared while nothing reads the attributes', async () => {
        // Given the attributes were computed once and their only reader unmounted
        const firstRender = renderHook(() => useAllReportAttributes());
        await waitForBatchedUpdatesWithAct();
        expect(firstRender.result.current[DM_ID]).toBeDefined();
        firstRender.unmount();

        // When the user signs out and another account with different reports signs in
        await Onyx.clear();
        await Onyx.multiSet({
            [ONYXKEYS.SESSION]: {accountID: CURRENT_USER_ACCOUNT_ID, email: 'user1@test.com'},
            [`${ONYXKEYS.COLLECTION.REPORT}99` as const]: {...dm, reportID: '99'},
        });
        await waitForBatchedUpdatesWithAct();
        const {result} = renderHook(() => useAllReportAttributes());
        await waitForBatchedUpdatesWithAct();

        // Then only the new account's reports have attributes
        expect(Object.keys(result.current)).toEqual(['99']);
    });

    it('should read the live report name inside the Search scope', async () => {
        // Given a reader rendered inside the Search page, where useOnyx reads Search snapshot data
        const wrapper = ({children}: PropsWithChildren) => (
            <SearchScopeProvider>
                <SearchQueryContext.Provider value={createMock<SearchQueryContextValue>({currentSearchHash: SEARCH_HASH})}>{children}</SearchQueryContext.Provider>
            </SearchScopeProvider>
        );
        await Onyx.merge(`${ONYXKEYS.COLLECTION.SNAPSHOT}${SEARCH_HASH}`, {data: {[`${ONYXKEYS.COLLECTION.REPORT}${DM_ID}` as const]: {...dm, reportName: 'Snapshot name'}}});
        const {result} = renderHook(() => useReportName(DM_ID), {wrapper});
        await waitForBatchedUpdatesWithAct();

        // When the live report changes
        await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {[OTHER_ACCOUNT_ID]: {displayName: 'Renamed Person'}});
        await waitForBatchedUpdatesWithAct();

        // Then the name follows the live data, as the derived value always did
        expect(result.current).toBe('Renamed Person');
    });

    it('should not re-render a single-name reader when another report changes', async () => {
        // Given a component reading one report's name
        let renderCount = 0;
        const {result} = renderHook(() => {
            renderCount++;
            return useReportName(DM_ID);
        });
        await waitForBatchedUpdatesWithAct();
        const rendersAfterMount = renderCount;

        // When a different report changes
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${EXPENSE_REPORT_ID}`, {total: -5000});
        await waitForBatchedUpdatesWithAct();

        // Then the reader keeps its name and does not render again
        expect(result.current).toBe('User Two');
        expect(renderCount).toBe(rendersAfterMount);
    });

    it('should return the names of the requested reports only', async () => {
        // Given a component that shows the names of a DM and a report that does not exist
        const {result} = renderHook(() => useReportNames([DM_ID, 'missing', undefined]));
        await waitForBatchedUpdatesWithAct();

        // Then it gets one entry per given reportID, with no name for the missing report
        expect(result.current).toEqual({[DM_ID]: 'User Two', missing: undefined});
    });

    it('should flip isEmpty when the first message lands in a report', async () => {
        // Given a DM without any message
        const {result} = renderHook(() => useIsEmptyReport(DM_ID));
        await waitForBatchedUpdatesWithAct();
        expect(result.current).toBe(true);

        // When a message arrives
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${DM_ID}`, {lastMessageText: 'Hello'});
        await waitForBatchedUpdatesWithAct();

        // Then the DM is no longer empty
        expect(result.current).toBe(false);
    });

    it('should return only the badge and RBR fields of one report', async () => {
        // Given a report screen reading the status of the workspace chat
        const {result} = renderHook(() => useReportStatus(WORKSPACE_CHAT_ID));
        await waitForBatchedUpdatesWithAct();

        // When an expense on that chat gets a violation
        await Onyx.set(`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${TRANSACTION_ID}`, [
            {name: CONST.VIOLATIONS.AUTO_REPORTED_REJECTED_EXPENSE, type: CONST.VIOLATION_TYPES.VIOLATION, showInReview: true},
        ]);
        await waitForBatchedUpdatesWithAct();

        // Then the screen gets the Fix badge and the RBR, and nothing else
        expect(result.current).toEqual({actionBadge: CONST.REPORT.ACTION_BADGE.FIX, actionTargetReportActionID: undefined, brickRoadStatus: CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR});
    });

    describe('snapshot', () => {
        it('should save the attributes for the next app start', async () => {
            // Given the attributes were computed
            const {result} = renderHook(() => useAllReportAttributes());
            await waitForBatchedUpdatesWithAct();

            // When the app goes to the background before the idle save ran
            flushReportAttributesSnapshot();
            await waitForBatchedUpdatesWithAct();

            // Then the snapshot holds the same attributes, tagged with the account and locale
            const snapshot = await getOnyxValue(ONYXKEYS.REPORT_ATTRIBUTES_SNAPSHOT);
            expect(snapshot?.reports).toEqual(result.current);
            expect(snapshot?.accountID).toBe(CURRENT_USER_ACCOUNT_ID);
            expect(snapshot?.locale).toBe(CONST.LOCALES.EN);
        });

        it('should start from the snapshot and compute only the reports it lacks', async () => {
            // Given a fresh start with a snapshot of this account that names the DM differently and lacks the expense report
            await Onyx.clear();
            await seedAccount();
            await Onyx.set(ONYXKEYS.REPORT_ATTRIBUTES_SNAPSHOT, {
                accountID: CURRENT_USER_ACCOUNT_ID,
                locale: CONST.LOCALES.EN,
                reports: {
                    [DM_ID]: {reportName: 'Saved name', isEmpty: true, brickRoadStatus: undefined, requiresAttention: false, reportErrors: {}},
                    [WORKSPACE_CHAT_ID]: {reportName: 'Saved chat', isEmpty: true, brickRoadStatus: undefined, requiresAttention: false, reportErrors: {}},
                    gone: {reportName: 'Deleted report', isEmpty: true, brickRoadStatus: undefined, requiresAttention: false, reportErrors: {}},
                },
            });
            await waitForBatchedUpdatesWithAct();

            // When the attributes are first read
            const {result} = renderHook(() => useAllReportAttributes());
            await waitForBatchedUpdatesWithAct();

            // Then the saved names are trusted, the missing report is computed and the deleted one is dropped
            expect(result.current[DM_ID]?.reportName).toBe('Saved name');
            expect(result.current[EXPENSE_REPORT_ID]?.reportName).toBeTruthy();
            expect(result.current.gone).toBeUndefined();
        });

        it('should ignore a snapshot of another account', async () => {
            // Given a fresh start with a snapshot saved for a different account
            await Onyx.clear();
            await seedAccount();
            await Onyx.set(ONYXKEYS.REPORT_ATTRIBUTES_SNAPSHOT, {
                accountID: 999,
                locale: CONST.LOCALES.EN,
                reports: {[DM_ID]: {reportName: 'Other account', isEmpty: true, brickRoadStatus: undefined, requiresAttention: false, reportErrors: {}}},
            });
            await waitForBatchedUpdatesWithAct();

            // When the attributes are first read
            const {result} = renderHook(() => useAllReportAttributes());
            await waitForBatchedUpdatesWithAct();

            // Then everything is computed from this account's data
            expect(result.current[DM_ID]?.reportName).toBe('User Two');
        });
    });
});
