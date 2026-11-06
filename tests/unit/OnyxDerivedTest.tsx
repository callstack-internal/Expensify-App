import {act, renderHook} from '@testing-library/react-native';

import useOnyx from '@hooks/useOnyx';

import * as ActiveSpans from '@libs/telemetry/activeSpans';

import {KEYS_TO_PRESERVE_DELEGATE_ACCESS} from '@userActions/Delegate';
import initOnyxDerivedValues from '@userActions/OnyxDerived';
import * as OnyxDerivedUtils from '@userActions/OnyxDerived/utils';

import CONST from '@src/CONST';
import IntlStore from '@src/languages/IntlStore';
import ONYXKEYS from '@src/ONYXKEYS';
import type {PersonalDetailsList, Transaction, TransactionViolation, ReportAction} from '@src/types/onyx';

import type {OnyxUpdate} from 'react-native-onyx';
import type {TupleToUnion} from 'type-fest';

/* eslint-disable @typescript-eslint/naming-convention */
import Onyx from 'react-native-onyx';
import OnyxUtils from 'react-native-onyx/dist/OnyxUtils';

import {createRandomCompanyCard, createRandomExpensifyCard} from '../utils/collections/card';
import {createRandomReport} from '../utils/collections/reports';
import createRandomTransaction from '../utils/collections/transaction';
import getOnyxValue from '../utils/getOnyxValue';
import {createMockReport, getFakeReportAction} from '../utils/ReportTestUtils';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

const onyxDerivedTestSetup = () => {
    Onyx.init({keys: ONYXKEYS});
    initOnyxDerivedValues();
};

const GUIDE_ACCOUNT_ID = 8;
const MEMBER_ACCOUNT_ID = 1;
const NEW_GUIDE_ACCOUNT_ID = 9;
const NEW_MEMBER_ACCOUNT_ID = 2;

const PERSONAL_DETAILS: PersonalDetailsList = {
    [GUIDE_ACCOUNT_ID]: {accountID: GUIDE_ACCOUNT_ID, login: `guide@${CONST.EMAIL.GUIDES_DOMAIN}`, displayName: 'Guide'},
    [MEMBER_ACCOUNT_ID]: {accountID: MEMBER_ACCOUNT_ID, login: 'member@example.com', displayName: 'Member'},
};

const KEYS_READ_WITHOUT_SELECTOR = [ONYXKEYS.DERIVED.GUIDE_ACCOUNT_IDS, ONYXKEYS.DERIVED.LOGIN_TO_ACCOUNT_ID_MAP] as const;

function renderHookWithoutSelector<TKey extends TupleToUnion<typeof KEYS_READ_WITHOUT_SELECTOR> | typeof ONYXKEYS.DERIVED.OUTSTANDING_REPORTS_BY_POLICY_ID>(key: TKey) {
    let renderCount = 0;
    const hook = renderHook(() => {
        renderCount++;
        return useOnyx(key);
    });
    return {hook, getRenderCount: () => renderCount};
}

function getGuideWrites(setDerivedValueSpy: jest.Spied<typeof OnyxDerivedUtils.setDerivedValue>) {
    return setDerivedValueSpy.mock.calls.filter(([key]) => key === ONYXKEYS.DERIVED.GUIDE_ACCOUNT_IDS);
}

describe('OnyxDerived', () => {
    beforeAll(async () => {
        onyxDerivedTestSetup();
    });

    beforeEach(async () => {
        await Onyx.clear();
    });

    describe('coalescing', () => {
        // Each flush writes the derived value exactly once via setDerivedValue, so counting its calls for a key
        // counts how many times that value was recomputed.
        const countRecomputes = (spy: jest.SpyInstance, derivedKey: string) => spy.mock.calls.filter(([calledKey]) => calledKey === derivedKey).length;

        it('coalesces the dependency changes from a single Onyx.update batch (without dropping any)', async () => {
            // Given the derived value is populated and its connections are warm
            await Onyx.set(`${ONYXKEYS.COLLECTION.TRANSACTION}1`, {...createRandomTransaction(1), transactionID: '1', reportID: 'r1'});
            await waitForBatchedUpdates();
            const setDerivedValueSpy = jest.spyOn(OnyxDerivedUtils, 'setDerivedValue');

            // When one logical update touches both of its dependencies at once
            await Onyx.update([
                {
                    onyxMethod: Onyx.METHOD.MERGE_COLLECTION,
                    key: ONYXKEYS.COLLECTION.TRANSACTION,
                    value: {[`${ONYXKEYS.COLLECTION.TRANSACTION}2`]: {...createRandomTransaction(2), transactionID: '2', reportID: 'r1'}},
                },
                {
                    onyxMethod: Onyx.METHOD.MERGE_COLLECTION,
                    key: ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS,
                    value: {[`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}1`]: [{name: CONST.VIOLATIONS.MISSING_CATEGORY, type: CONST.VIOLATION_TYPES.VIOLATION}]},
                },
            ]);
            await waitForBatchedUpdates();

            // Then it recomputes fewer times than once per changed dependency, without dropping either change.
            // Onyx.update can span a couple of microtask turns, so the count is bounded rather than exact.
            expect(countRecomputes(setDerivedValueSpy, ONYXKEYS.DERIVED.REPORT_TRANSACTIONS_AND_VIOLATIONS)).toBeLessThan(2);
            const derived = await OnyxUtils.get(ONYXKEYS.DERIVED.REPORT_TRANSACTIONS_AND_VIOLATIONS);
            expect(Object.keys(derived?.r1?.transactions ?? {})).toHaveLength(2);
            expect(derived?.r1?.violations?.[`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}1`]).toHaveLength(1);
            setDerivedValueSpy.mockRestore();
        });

        it('applies every change from separate merges in the same tick without dropping any', async () => {
            // Given the derived value is populated
            await Onyx.set(`${ONYXKEYS.COLLECTION.TRANSACTION}1`, {...createRandomTransaction(1), transactionID: '1', reportID: 'r1'});
            await waitForBatchedUpdates();

            // When separate merges to both dependencies fire in the same tick, without awaiting in between
            Onyx.merge(`${ONYXKEYS.COLLECTION.TRANSACTION}2`, {...createRandomTransaction(2), transactionID: '2', reportID: 'r1'});
            Onyx.merge(`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}1`, [{name: CONST.VIOLATIONS.MISSING_CATEGORY, type: CONST.VIOLATION_TYPES.VIOLATION}]);
            await waitForBatchedUpdates();

            // Then the final value reflects both, even if they took separate recomputes
            const derived = await OnyxUtils.get(ONYXKEYS.DERIVED.REPORT_TRANSACTIONS_AND_VIOLATIONS);
            expect(Object.keys(derived?.r1?.transactions ?? {})).toHaveLength(2);
            expect(derived?.r1?.violations?.[`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}1`]).toHaveLength(1);
        });
    });

    describe('reportTransactionsAndViolations', () => {
        it('keeps a violations-only change for one transaction when coalesced with a transaction change for another', async () => {
            const transactionA: Transaction = {...createRandomTransaction(1), transactionID: 'A', reportID: 'rA', amount: 100};
            const transactionB: Transaction = {...createRandomTransaction(2), transactionID: 'B', reportID: 'rB', amount: 200};

            // Prime so both transactions are tracked and the connections are warm.
            await Onyx.multiSet({
                [`${ONYXKEYS.COLLECTION.TRANSACTION}A` as const]: transactionA,
                [`${ONYXKEYS.COLLECTION.TRANSACTION}B` as const]: transactionB,
            });
            await waitForBatchedUpdates();

            const violation: TransactionViolation = {type: CONST.VIOLATION_TYPES.VIOLATION, name: CONST.VIOLATIONS.MISSING_CATEGORY};

            // One logical update: transaction A changes AND violations change for transaction B.
            const updates: Array<OnyxUpdate<typeof ONYXKEYS.COLLECTION.TRANSACTION | typeof ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS>> = [
                {onyxMethod: Onyx.METHOD.MERGE_COLLECTION, key: ONYXKEYS.COLLECTION.TRANSACTION, value: {[`${ONYXKEYS.COLLECTION.TRANSACTION}A`]: {amount: 999}}},
                {onyxMethod: Onyx.METHOD.MERGE_COLLECTION, key: ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS, value: {[`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}B`]: [violation]}},
            ];
            await Onyx.update(updates);
            await waitForBatchedUpdates();

            const derived = await OnyxUtils.get(ONYXKEYS.DERIVED.REPORT_TRANSACTIONS_AND_VIOLATIONS);

            // The batched violations change for B must not be dropped...
            expect(derived?.rB?.violations?.[`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}B`]).toEqual([violation]);
            // ...and the transaction change for A must also land.
            expect(derived?.rA?.transactions?.[`${ONYXKEYS.COLLECTION.TRANSACTION}A`]?.amount).toBe(999);
        });
    });

    describe('sortedReportActions', () => {
        it('applies a REPORT change that is coalesced with a REPORT_ACTIONS change for another report', async () => {
            const chatReportID = '10';
            const expenseReportID = '20';
            const parentChatReportID = '30';
            const threadReportID = '40';

            const iouAction = getFakeReportAction(100, {
                actionName: CONST.REPORT.ACTIONS.TYPE.IOU,
                childReportID: threadReportID,
                reportID: expenseReportID,
                originalMessage: {IOUTransactionID: 'txn1', type: CONST.IOU.REPORT_ACTION_TYPE.CREATE, amount: 100, currency: 'USD'},
            } as Partial<ReportAction>);

            await Onyx.multiSet({
                [`${ONYXKEYS.COLLECTION.REPORT}${chatReportID}` as const]: createMockReport({reportID: chatReportID, type: CONST.REPORT.TYPE.CHAT}),
                // The expense report starts as a CHAT, so its one-transaction thread does not resolve yet.
                [`${ONYXKEYS.COLLECTION.REPORT}${expenseReportID}` as const]: createMockReport({reportID: expenseReportID, type: CONST.REPORT.TYPE.CHAT, chatReportID: parentChatReportID}),
                [`${ONYXKEYS.COLLECTION.REPORT}${parentChatReportID}` as const]: createMockReport({reportID: parentChatReportID, type: CONST.REPORT.TYPE.CHAT}),
                [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${chatReportID}` as const]: {'1': getFakeReportAction(1, {actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT})},
                [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${expenseReportID}` as const]: {'100': iouAction},
                [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${threadReportID}` as const]: {'200': getFakeReportAction(200, {actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT})},
            });
            await waitForBatchedUpdates();

            // Precondition: while it is a CHAT, no transaction thread is resolved for the report.
            let derived = await OnyxUtils.get(ONYXKEYS.DERIVED.RAM_ONLY_SORTED_REPORT_ACTIONS);
            expect(derived?.transactionThreadIDs?.[expenseReportID]).toBeUndefined();

            // One logical update: flip the report to EXPENSE (a REPORT change that resolves its thread) batched
            // with an unrelated REPORT_ACTIONS change to a different report.
            const updates: Array<OnyxUpdate<typeof ONYXKEYS.COLLECTION.REPORT | typeof ONYXKEYS.COLLECTION.REPORT_ACTIONS>> = [
                {onyxMethod: Onyx.METHOD.MERGE_COLLECTION, key: ONYXKEYS.COLLECTION.REPORT, value: {[`${ONYXKEYS.COLLECTION.REPORT}${expenseReportID}`]: {type: CONST.REPORT.TYPE.EXPENSE}}},
                {
                    onyxMethod: Onyx.METHOD.MERGE_COLLECTION,
                    key: ONYXKEYS.COLLECTION.REPORT_ACTIONS,
                    value: {[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${chatReportID}`]: {'2': getFakeReportAction(2, {actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT})}},
                },
            ];
            await Onyx.update(updates);
            await waitForBatchedUpdates();

            // The batched REPORT change must be applied: the expense report's transaction thread now resolves.
            derived = await OnyxUtils.get(ONYXKEYS.DERIVED.RAM_ONLY_SORTED_REPORT_ACTIONS);
            expect(derived?.transactionThreadIDs?.[expenseReportID]).toBe(threadReportID);
        });
    });

    describe('nonPersonalAndWorkspaceCardList', () => {
        beforeAll(async () => {
            // Initialize dependency keys so Onyx.clear() in beforeEach triggers derived value recomputation
            await Onyx.set(ONYXKEYS.CARD_LIST, {});
            await waitForBatchedUpdates();
        });

        it('returns empty object when dependencies are not set', async () => {
            await waitForBatchedUpdates();
            const derivedCardList = await OnyxUtils.get(ONYXKEYS.DERIVED.NON_PERSONAL_AND_WORKSPACE_CARD_LIST);
            expect(derivedCardList).toEqual({});
        });

        it('merges cardList and workspaceCardFeeds when dependencies are set', async () => {
            // Non-personal cards (fundID !== '0') from cardList are kept, workspace cards are always included
            const nonPersonalCard1 = createRandomExpensifyCard(1, {fundID: '123'});
            const nonPersonalCard2 = createRandomExpensifyCard(2, {fundID: '456'});
            const workspaceCard3 = createRandomCompanyCard(3, {bank: 'vcf'});

            await Onyx.set(ONYXKEYS.CARD_LIST, {
                '1': nonPersonalCard1,
                '2': nonPersonalCard2,
            });
            await Onyx.set(`${ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}workspace_123`, {
                '3': workspaceCard3,
            });
            await waitForBatchedUpdates();
            const derivedCardList = await OnyxUtils.get(ONYXKEYS.DERIVED.NON_PERSONAL_AND_WORKSPACE_CARD_LIST);

            expect(derivedCardList).toMatchObject({
                '1': expect.objectContaining({cardID: 1}),
                '2': expect.objectContaining({cardID: 2}),
                '3': expect.objectContaining({cardID: 3}),
            });
        });

        it('filters out personal cards from cardList when dependencies are set', async () => {
            const nonPersonalCard = createRandomExpensifyCard(1, {fundID: '123'});
            const personalCard = createRandomExpensifyCard(2, {fundID: '0'});
            const workspaceCard = createRandomCompanyCard(3, {bank: 'vcf'});

            await Onyx.set(ONYXKEYS.CARD_LIST, {
                '1': nonPersonalCard,
                '2': personalCard,
            });
            await Onyx.set(`${ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}workspace_123`, {
                '3': workspaceCard,
            });
            await waitForBatchedUpdates();
            const derivedCardList = await OnyxUtils.get(ONYXKEYS.DERIVED.NON_PERSONAL_AND_WORKSPACE_CARD_LIST);

            expect(derivedCardList?.['1']).toBeDefined();
            expect(derivedCardList?.['1']).toMatchObject({cardID: 1});
            expect(derivedCardList?.['2']).toBeUndefined();
            expect(derivedCardList?.['3']).toBeDefined();
            expect(derivedCardList?.['3']).toMatchObject({cardID: 3});
        });

        it('handles empty cardList when workspaceCardFeeds are set', async () => {
            const workspaceCard = createRandomCompanyCard(1, {bank: 'vcf'});

            await Onyx.set(ONYXKEYS.CARD_LIST, {});
            await Onyx.set(`${ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}workspace_123`, {
                '1': workspaceCard,
            });
            await waitForBatchedUpdates();
            const derivedCardList = await OnyxUtils.get(ONYXKEYS.DERIVED.NON_PERSONAL_AND_WORKSPACE_CARD_LIST);

            expect(derivedCardList).toMatchObject({
                '1': expect.objectContaining({cardID: 1}),
            });
        });

        it('handles empty workspaceCardFeeds when cardList is set', async () => {
            const nonPersonalCard = createRandomExpensifyCard(1, {fundID: '123'});

            await Onyx.set(ONYXKEYS.CARD_LIST, {
                '1': nonPersonalCard,
            });
            await waitForBatchedUpdates();
            const derivedCardList = await OnyxUtils.get(ONYXKEYS.DERIVED.NON_PERSONAL_AND_WORKSPACE_CARD_LIST);

            expect(derivedCardList).toMatchObject({
                '1': expect.objectContaining({cardID: 1}),
            });
        });

        it('includes cards from multiple workspace feeds when dependencies are set', async () => {
            const card1 = createRandomCompanyCard(1, {bank: 'vcf'});
            const card2 = createRandomCompanyCard(2, {bank: 'stripe'});

            await Onyx.set(ONYXKEYS.CARD_LIST, {});
            await Onyx.set(`${ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}workspace_123`, {
                '1': card1,
            });
            await Onyx.set(`${ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}workspace_456`, {
                '2': card2,
            });
            await waitForBatchedUpdates();
            const derivedCardList = await OnyxUtils.get(ONYXKEYS.DERIVED.NON_PERSONAL_AND_WORKSPACE_CARD_LIST);

            expect(derivedCardList).toMatchObject({
                '1': expect.objectContaining({cardID: 1}),
                '2': expect.objectContaining({cardID: 2}),
            });
        });
    });

    describe('personalAndWorkspaceCardList', () => {
        it('merges cardList and workspaceCardFeeds when dependencies are set', async () => {
            // Non-personal cards (fundID !== '0') from cardList are kept, workspace cards are always included
            const nonPersonalCard1 = createRandomExpensifyCard(1, {fundID: '123'});
            const nonPersonalCard2 = createRandomExpensifyCard(2, {fundID: '456'});
            const personalCard = createRandomExpensifyCard(3, {fundID: '0'});
            const workspaceCard3 = createRandomCompanyCard(4, {bank: 'vcf'});

            await Onyx.set(ONYXKEYS.CARD_LIST, {
                '1': nonPersonalCard1,
                '2': nonPersonalCard2,
                '3': personalCard,
            });
            await Onyx.set(`${ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}workspace_123`, {
                '4': workspaceCard3,
            });
            await waitForBatchedUpdates();
            const derivedCardList = await OnyxUtils.get(ONYXKEYS.DERIVED.PERSONAL_AND_WORKSPACE_CARD_LIST);

            expect(derivedCardList).toMatchObject({
                '1': expect.objectContaining({cardID: 1}),
                '2': expect.objectContaining({cardID: 2}),
                '3': expect.objectContaining({cardID: 3}),
                '4': expect.objectContaining({cardID: 4}),
            });
        });

        it('handles empty cardList when workspaceCardFeeds are set', async () => {
            const workspaceCard = createRandomCompanyCard(1, {bank: 'vcf'});

            await Onyx.set(ONYXKEYS.CARD_LIST, {});
            await Onyx.set(`${ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}workspace_123`, {
                '1': workspaceCard,
            });
            await waitForBatchedUpdates();
            const derivedCardList = await OnyxUtils.get(ONYXKEYS.DERIVED.PERSONAL_AND_WORKSPACE_CARD_LIST);

            expect(derivedCardList).toMatchObject({
                '1': expect.objectContaining({cardID: 1}),
            });
        });

        it('handles empty workspaceCardFeeds when cardList is set', async () => {
            const nonPersonalCard = createRandomExpensifyCard(1, {fundID: '123'});

            await Onyx.set(ONYXKEYS.CARD_LIST, {
                '1': nonPersonalCard,
            });
            await waitForBatchedUpdates();
            const derivedCardList = await OnyxUtils.get(ONYXKEYS.DERIVED.PERSONAL_AND_WORKSPACE_CARD_LIST);

            expect(derivedCardList).toMatchObject({
                '1': expect.objectContaining({cardID: 1}),
            });
        });

        it('includes cards from multiple workspace feeds when dependencies are set', async () => {
            const card1 = createRandomCompanyCard(1, {bank: 'vcf'});
            const card2 = createRandomCompanyCard(2, {bank: 'stripe'});

            await Onyx.set(ONYXKEYS.CARD_LIST, {});
            await Onyx.set(`${ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}workspace_123`, {
                '1': card1,
            });
            await Onyx.set(`${ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}workspace_456`, {
                '2': card2,
            });
            await waitForBatchedUpdates();
            const derivedCardList = await OnyxUtils.get(ONYXKEYS.DERIVED.PERSONAL_AND_WORKSPACE_CARD_LIST);

            expect(derivedCardList).toMatchObject({
                '1': expect.objectContaining({cardID: 1}),
                '2': expect.objectContaining({cardID: 2}),
            });
        });
    });

    describe('skipping the write when compute returns the current value', () => {
        beforeEach(async () => {
            jest.restoreAllMocks();
            await Onyx.set(ONYXKEYS.PERSONAL_DETAILS_LIST, PERSONAL_DETAILS);
            await waitForBatchedUpdates();
        });

        it('should not write to Onyx when compute returns the current value', async () => {
            // Given the guide accountIDs have been computed and stored
            const setDerivedValueSpy = jest.spyOn(OnyxDerivedUtils, 'setDerivedValue');

            // When a member is renamed, which recomputes the guides to the value already held
            await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {[MEMBER_ACCOUNT_ID]: {displayName: 'Renamed member'}});
            await waitForBatchedUpdates();

            // Then nothing is written, so subscribers aren't notified and the value isn't rewritten to disk
            expect(getGuideWrites(setDerivedValueSpy)).toHaveLength(0);
            expect(await getOnyxValue(ONYXKEYS.DERIVED.GUIDE_ACCOUNT_IDS)).toEqual([GUIDE_ACCOUNT_ID]);
        });

        it('should still end the compute span when the write is skipped', async () => {
            // Given the compute span is observed
            const endSpanSpy = jest.spyOn(ActiveSpans, 'endSpan');

            // When a recompute returns the current value and skips the write
            await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {[MEMBER_ACCOUNT_ID]: {displayName: 'Renamed member'}});
            await waitForBatchedUpdates();

            // Then the early return still goes through finally, so no compute span is left open
            expect(endSpanSpy).toHaveBeenCalledWith(`${CONST.TELEMETRY.SPAN_ONYX_DERIVED_COMPUTE}_${ONYXKEYS.DERIVED.GUIDE_ACCOUNT_IDS}`);
        });

        it('should rewrite the value after Onyx.clear', async () => {
            // Given the guide accountIDs are stored and Onyx is then cleared, as on sign-out
            await Onyx.clear();
            await waitForBatchedUpdates();
            const setDerivedValueSpy = jest.spyOn(OnyxDerivedUtils, 'setDerivedValue');

            // When the same personal details come back, as on signing in again
            await Onyx.set(ONYXKEYS.PERSONAL_DETAILS_LIST, PERSONAL_DETAILS);
            await waitForBatchedUpdates();

            // Then the engine writes the value again instead of treating the pre-clear value as current
            expect(getGuideWrites(setDerivedValueSpy).length).toBeGreaterThan(0);
            expect(await getOnyxValue(ONYXKEYS.DERIVED.GUIDE_ACCOUNT_IDS)).toEqual([GUIDE_ACCOUNT_ID]);
        });

        it('should restore derived keys after a clear that keeps PERSONAL_DETAILS_LIST', async () => {
            // Given the derived keys are computed, and Onyx is cleared with the keep list the delegate switch uses.
            // A preserved dependency is never notified, so the engine never resets and keeps the pre-clear value,
            // while Onyx drops the derived keys because they are not preserved.
            await Onyx.clear(KEYS_TO_PRESERVE_DELEGATE_ACCESS);
            await waitForBatchedUpdates();

            // When a personal details write changes a name but no login, as OpenApp does on return
            await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {[MEMBER_ACCOUNT_ID]: {displayName: 'Renamed member'}});
            await waitForBatchedUpdates();

            // Then both derived keys are written again rather than staying empty until a login set changes
            expect(await getOnyxValue(ONYXKEYS.DERIVED.LOGIN_TO_ACCOUNT_ID_MAP)).toEqual({
                [`guide@${CONST.EMAIL.GUIDES_DOMAIN}`]: GUIDE_ACCOUNT_ID,
                'member@example.com': MEMBER_ACCOUNT_ID,
            });
            expect(await getOnyxValue(ONYXKEYS.DERIVED.GUIDE_ACCOUNT_IDS)).toEqual([GUIDE_ACCOUNT_ID]);
        });
    });

    describe('consumers without a selector on PERSONAL_DETAILS_LIST writes', () => {
        beforeAll(async () => {
            await IntlStore.load(CONST.LOCALES.EN);
        });

        beforeEach(async () => {
            await act(async () => {
                await Onyx.set(ONYXKEYS.RAM_ONLY_ARE_TRANSLATIONS_LOADING, false);
                await Onyx.set(ONYXKEYS.PERSONAL_DETAILS_LIST, PERSONAL_DETAILS);
            });
            await waitForBatchedUpdatesWithAct();
        });

        it.each(KEYS_READ_WITHOUT_SELECTOR)('should keep the %s reference when an unrelated personal detail changes', async (key) => {
            // Given a component that reads the derived value without a selector, the way 10 App sites do
            const {hook, getRenderCount} = renderHookWithoutSelector(key);
            await waitForBatchedUpdatesWithAct();
            const [valueBefore] = hook.result.current;
            const rendersBefore = getRenderCount();

            // When a member renames themselves, which leaves both derived values with the same content
            await act(async () => {
                await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {[MEMBER_ACCOUNT_ID]: {displayName: 'Renamed member'}});
            });
            await waitForBatchedUpdatesWithAct();

            // Then the engine's fresh but equal result must not reach the consumer as a new reference or a re-render
            expect(hook.result.current[0]).toBe(valueBefore);
            expect(getRenderCount()).toBe(rendersBefore);
        });

        it('should return new guide accountIDs when a guide is added', async () => {
            // Given a consumer of the guide accountIDs
            const {hook} = renderHookWithoutSelector(ONYXKEYS.DERIVED.GUIDE_ACCOUNT_IDS);
            await waitForBatchedUpdatesWithAct();
            const [valueBefore] = hook.result.current;

            // When a second guide's personal details arrive
            await act(async () => {
                await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {
                    [NEW_GUIDE_ACCOUNT_ID]: {accountID: NEW_GUIDE_ACCOUNT_ID, login: `new.guide@${CONST.EMAIL.GUIDES_DOMAIN}`},
                });
            });
            await waitForBatchedUpdatesWithAct();

            // Then the consumer sees the change, so the stability check above is not passing on a frozen value
            expect(hook.result.current[0]).not.toBe(valueBefore);
            expect(hook.result.current[0]).toEqual([GUIDE_ACCOUNT_ID, NEW_GUIDE_ACCOUNT_ID]);
        });

        it('should return a new login map when a login is added', async () => {
            // Given a consumer of the login to accountID map
            const {hook} = renderHookWithoutSelector(ONYXKEYS.DERIVED.LOGIN_TO_ACCOUNT_ID_MAP);
            await waitForBatchedUpdatesWithAct();
            const [valueBefore] = hook.result.current;

            // When a new member's personal details arrive
            await act(async () => {
                await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {
                    [NEW_MEMBER_ACCOUNT_ID]: {accountID: NEW_MEMBER_ACCOUNT_ID, login: 'new.member@example.com'},
                });
            });
            await waitForBatchedUpdatesWithAct();

            // Then the consumer sees the new login
            expect(hook.result.current[0]).not.toBe(valueBefore);
            expect(hook.result.current[0]?.['new.member@example.com']).toBe(NEW_MEMBER_ACCOUNT_ID);
        });
    });

    describe('consumers without a selector on REPORT writes', () => {
        const CHAT_REPORT_ID = '100';
        const EXPENSE_REPORT_ID = '200';
        const POLICY_ID = 'policy1';

        beforeAll(async () => {
            await IntlStore.load(CONST.LOCALES.EN);
        });

        beforeEach(async () => {
            await act(async () => {
                await Onyx.set(ONYXKEYS.RAM_ONLY_ARE_TRANSLATIONS_LOADING, false);
                await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${CHAT_REPORT_ID}`, {
                    ...createRandomReport(Number(CHAT_REPORT_ID)),
                    type: CONST.REPORT.TYPE.CHAT,
                    policyID: undefined,
                });
            });
            await waitForBatchedUpdatesWithAct();
        });

        it('should keep the outstanding reports reference when a report with no outstanding expenses changes', async () => {
            // Given a component that reads the derived value without a selector, the way 10 App sites do, on an
            // account with no outstanding expense reports so every compute produces an equal but fresh empty object
            const {hook, getRenderCount} = renderHookWithoutSelector(ONYXKEYS.DERIVED.OUTSTANDING_REPORTS_BY_POLICY_ID);
            await waitForBatchedUpdatesWithAct();
            const [valueBefore] = hook.result.current;
            const rendersBefore = getRenderCount();

            // When chat reports are written, which the derived value does not list
            await act(async () => {
                for (let i = 0; i < 5; i++) {
                    await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${CHAT_REPORT_ID}`, {lastMessageText: `message ${i}`});
                }
            });
            await waitForBatchedUpdatesWithAct();

            // Then the engine's fresh but equal result must not reach the consumer as a new reference or a re-render
            expect(hook.result.current[0]).toBe(valueBefore);
            expect(getRenderCount()).toBe(rendersBefore);
        });

        it('should return new outstanding reports when an outstanding expense report arrives', async () => {
            // Given a consumer of the outstanding reports
            const {hook} = renderHookWithoutSelector(ONYXKEYS.DERIVED.OUTSTANDING_REPORTS_BY_POLICY_ID);
            await waitForBatchedUpdatesWithAct();
            const [valueBefore] = hook.result.current;

            // When an open expense report on a workspace arrives
            await act(async () => {
                await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${EXPENSE_REPORT_ID}`, {
                    reportID: EXPENSE_REPORT_ID,
                    type: CONST.REPORT.TYPE.EXPENSE,
                    policyID: POLICY_ID,
                    stateNum: CONST.REPORT.STATE_NUM.OPEN,
                });
            });
            await waitForBatchedUpdatesWithAct();

            // Then the consumer sees the change, so the stability check above is not passing on a frozen value
            expect(hook.result.current[0]).not.toBe(valueBefore);
            expect(hook.result.current[0]?.[POLICY_ID]?.[`${ONYXKEYS.COLLECTION.REPORT}${EXPENSE_REPORT_ID}`]).toBeTruthy();
        });
    });
});
