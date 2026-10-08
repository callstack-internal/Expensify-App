import {act, renderHook} from '@testing-library/react-native';

import useOutstandingReportsByPolicyID, {useOutstandingReportsForPolicy} from '@hooks/useOutstandingReportsByPolicyID';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report} from '@src/types/onyx';

import Onyx from 'react-native-onyx';

import waitForBatchedUpdatesWithAct from '../../utils/waitForBatchedUpdatesWithAct';

const POLICY_ID = 'policy1';
const OTHER_POLICY_ID = 'policy2';
const OPEN_REPORT_KEY = `${ONYXKEYS.COLLECTION.REPORT}1` as const;
const OTHER_POLICY_REPORT_KEY = `${ONYXKEYS.COLLECTION.REPORT}2` as const;
const CHAT_REPORT_KEY = `${ONYXKEYS.COLLECTION.REPORT}3` as const;
const NEW_REPORT_KEY = `${ONYXKEYS.COLLECTION.REPORT}4` as const;

const openReport: Report = {reportID: '1', policyID: POLICY_ID, type: CONST.REPORT.TYPE.EXPENSE, stateNum: CONST.REPORT.STATE_NUM.OPEN};
const otherPolicyReport: Report = {reportID: '2', policyID: OTHER_POLICY_ID, type: CONST.REPORT.TYPE.EXPENSE, stateNum: CONST.REPORT.STATE_NUM.OPEN};
const chatReport: Report = {reportID: '3', policyID: POLICY_ID, chatType: CONST.REPORT.CHAT_TYPE.POLICY_ROOM, reportName: 'Before'};

async function seedReports() {
    await act(async () => {
        await Onyx.multiSet({
            [OPEN_REPORT_KEY]: openReport,
            [OTHER_POLICY_REPORT_KEY]: otherPolicyReport,
            [CHAT_REPORT_KEY]: chatReport,
        });
    });
}

describe('useOutstandingReportsByPolicyID', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        await act(async () => {
            await Onyx.clear();
        });
    });

    it('should follow writes to the reports', async () => {
        // Given an open expense report in each of two policies
        await seedReports();
        const {result} = renderHook(() => useOutstandingReportsByPolicyID());
        await waitForBatchedUpdatesWithAct();
        expect(Object.keys(result.current[POLICY_ID] ?? {})).toEqual([OPEN_REPORT_KEY]);

        // When another open expense report arrives in the first policy
        await act(async () => {
            await Onyx.set(NEW_REPORT_KEY, {reportID: '4', policyID: POLICY_ID, type: CONST.REPORT.TYPE.EXPENSE, stateNum: CONST.REPORT.STATE_NUM.SUBMITTED});
        });
        await waitForBatchedUpdatesWithAct();

        // Then the hook lists it, since it reads the reports live instead of a stored derived value
        expect(Object.keys(result.current[POLICY_ID] ?? {}).sort()).toEqual([OPEN_REPORT_KEY, NEW_REPORT_KEY]);
    });

    it('should not re-render when a write leaves every outstanding report unchanged', async () => {
        // Given open expense reports and a chat
        await seedReports();
        let renderCount = 0;
        const {result} = renderHook(() => {
            renderCount++;
            return useOutstandingReportsByPolicyID();
        });
        await waitForBatchedUpdatesWithAct();
        const mapBeforeWrite = result.current;
        const renderCountBeforeWrite = renderCount;

        // When the chat is renamed, which is not an outstanding report
        await act(async () => {
            await Onyx.merge(CHAT_REPORT_KEY, {reportName: 'After'});
        });
        await waitForBatchedUpdatesWithAct();

        // Then the consumer keeps the same map and does not re-render
        expect(result.current).toBe(mapBeforeWrite);
        expect(renderCount).toBe(renderCountBeforeWrite);
    });

    it('should give every mounted consumer the same map', async () => {
        // Given two consumers mounted over the same reports
        await seedReports();
        const {result: first} = renderHook(() => useOutstandingReportsByPolicyID());
        const {result: second} = renderHook(() => useOutstandingReportsByPolicyID());
        await waitForBatchedUpdatesWithAct();

        // When an outstanding report changes
        await act(async () => {
            await Onyx.merge(OPEN_REPORT_KEY, {total: 100});
        });
        await waitForBatchedUpdatesWithAct();

        // Then both get the same object, because the map is built once per report collection, not once per consumer
        expect(second.current).toBe(first.current);
        expect(first.current[POLICY_ID]?.[OPEN_REPORT_KEY]?.total).toBe(100);
    });

    it('should not re-render a single policy consumer when only another policy changes', async () => {
        // Given a consumer of the first policy's outstanding reports
        await seedReports();
        let renderCount = 0;
        const {result} = renderHook(() => {
            renderCount++;
            return useOutstandingReportsForPolicy(POLICY_ID);
        });
        await waitForBatchedUpdatesWithAct();
        const reportsBeforeWrite = result.current;
        const renderCountBeforeWrite = renderCount;
        expect(Object.keys(reportsBeforeWrite ?? {})).toEqual([OPEN_REPORT_KEY]);

        // When the other policy's outstanding report changes
        await act(async () => {
            await Onyx.merge(OTHER_POLICY_REPORT_KEY, {total: 100});
        });
        await waitForBatchedUpdatesWithAct();

        // Then the consumer keeps the same reports and does not re-render
        expect(result.current).toBe(reportsBeforeWrite);
        expect(renderCount).toBe(renderCountBeforeWrite);
    });

    it('should return nothing for a policy without outstanding reports', async () => {
        // Given open expense reports in two policies
        await seedReports();

        // When a consumer reads a policy that has none, or no policy at all
        const {result: unknownPolicy} = renderHook(() => useOutstandingReportsForPolicy('policy3'));
        const {result: noPolicy} = renderHook(() => useOutstandingReportsForPolicy(undefined));
        await waitForBatchedUpdatesWithAct();

        // Then both get undefined, as the per-policy selector on the derived value returned
        expect(unknownPolicy.current).toBeUndefined();
        expect(noPolicy.current).toBeUndefined();
    });
});
