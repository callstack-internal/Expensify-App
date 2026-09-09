import {getOnyxProbeReport, isOnyxProbeRunning, startOnyxProbe, stopOnyxProbe} from '@libs/OnyxSubscriptionProbe';

import ONYXKEYS from '@src/ONYXKEYS';

import Onyx from 'react-native-onyx';

import waitForBatchedUpdates from '../../utils/waitForBatchedUpdates';

const REPORT_ONE = `${ONYXKEYS.COLLECTION.REPORT}1` as const;
const REPORT_TWO = `${ONYXKEYS.COLLECTION.REPORT}2` as const;

describe('OnyxSubscriptionProbe', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        await Onyx.clear();
        await waitForBatchedUpdates();
    });

    afterEach(() => {
        if (!isOnyxProbeRunning()) {
            return;
        }
        stopOnyxProbe();
    });

    it('is inert until started', () => {
        expect(isOnyxProbeRunning()).toBe(false);
    });

    it('counts a subscribe and its notifies', async () => {
        startOnyxProbe();

        const connection = Onyx.connectWithoutView({key: REPORT_ONE, callback: () => {}});
        await waitForBatchedUpdates();

        await Onyx.merge(REPORT_ONE, {reportName: 'first'});
        await Onyx.merge(REPORT_ONE, {reportName: 'second'});
        await waitForBatchedUpdates();

        Onyx.disconnect(connection);
        const report = stopOnyxProbe();

        const reportStat = report.byKey[ONYXKEYS.COLLECTION.REPORT];
        expect(reportStat.subscribes).toBe(1);
        expect(reportStat.unsubscribes).toBe(1);
        expect(reportStat.notifies).toBeGreaterThanOrEqual(2);
        expect(report.totals.notifies).toBe(reportStat.notifies);
    });

    it('groups collection members under their collection prefix and tracks peak concurrency', async () => {
        startOnyxProbe();

        const first = Onyx.connectWithoutView({key: REPORT_ONE, callback: () => {}});
        const second = Onyx.connectWithoutView({key: REPORT_TWO, callback: () => {}});
        await waitForBatchedUpdates();

        const reportStat = getOnyxProbeReport().byKey[ONYXKEYS.COLLECTION.REPORT];
        expect(reportStat.subscribes).toBe(2);
        expect(reportStat.peakConcurrent).toBe(2);

        Onyx.disconnect(first);
        Onyx.disconnect(second);

        const report = stopOnyxProbe();
        expect(report.byKey[ONYXKEYS.COLLECTION.REPORT].peakConcurrent).toBe(2);
        expect(report.byKey[ONYXKEYS.COLLECTION.REPORT].unsubscribes).toBe(2);
    });

    it('does not attribute a notify to a key the subscriber did not watch', async () => {
        startOnyxProbe();

        const connection = Onyx.connectWithoutView({key: REPORT_ONE, callback: () => {}});
        await waitForBatchedUpdates();

        await Onyx.merge(ONYXKEYS.ACCOUNT, {isLoading: false});
        await waitForBatchedUpdates();

        Onyx.disconnect(connection);
        const report = stopOnyxProbe();

        expect(report.byKey[ONYXKEYS.ACCOUNT]).toBeUndefined();
    });

    it('restores the connection manager on stop so counting does not leak', async () => {
        startOnyxProbe();
        expect(isOnyxProbeRunning()).toBe(true);
        stopOnyxProbe();
        expect(isOnyxProbeRunning()).toBe(false);

        const connection = Onyx.connectWithoutView({key: REPORT_ONE, callback: () => {}});
        await waitForBatchedUpdates();
        await Onyx.merge(REPORT_ONE, {reportName: 'after stop'});
        await waitForBatchedUpdates();
        Onyx.disconnect(connection);

        startOnyxProbe();
        expect(getOnyxProbeReport().totals.notifies).toBe(0);
    });

    it('separates a whole-collection subscribe from a member subscribe', async () => {
        startOnyxProbe();

        const member = Onyx.connectWithoutView({key: REPORT_ONE, callback: () => {}});
        await waitForBatchedUpdates();

        expect(getOnyxProbeReport().byKey[ONYXKEYS.COLLECTION.REPORT].rootSubscribes).toBe(0);

        const root = Onyx.connectWithoutView({key: ONYXKEYS.COLLECTION.REPORT, callback: () => {}});
        await waitForBatchedUpdates();

        const reportStat = getOnyxProbeReport().byKey[ONYXKEYS.COLLECTION.REPORT];
        expect(reportStat.subscribes).toBe(2);
        expect(reportStat.rootSubscribes).toBe(1);

        Onyx.disconnect(member);
        Onyx.disconnect(root);
        stopOnyxProbe();
    });

    it('is a no-op when started twice', () => {
        startOnyxProbe();
        startOnyxProbe();
        stopOnyxProbe();
        expect(isOnyxProbeRunning()).toBe(false);
    });
});
