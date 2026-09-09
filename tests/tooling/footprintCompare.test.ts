import {describe, expect, test} from 'bun:test';

import type {FootprintCapture, FootprintRun, OnyxKeyStat, RenderStat} from '../../scripts/footprint/types';

import {aggregateRuns, median} from '../../scripts/footprint/aggregate';
import {compareCaptures} from '../../scripts/footprint/compare';

// Onyx collection keys end with an underscore; held as constants so they read as computed keys.
const REPORT = 'report_';
const REPORT_ACTIONS = 'reportActions_';
const TRANSACTIONS = 'transactions_';

function onyx(overrides: Partial<OnyxKeyStat> = {}): OnyxKeyStat {
    return {subscribes: 1, unsubscribes: 1, peakConcurrent: 1, notifies: 10, rootSubscribes: 0, ...overrides};
}

function capture(overrides: Partial<FootprintCapture> = {}): FootprintCapture {
    return {
        flow: 'create-expense-manual',
        platform: 'android',
        appId: 'com.expensify.chat.dev',
        runs: 5,
        commit: 'abc1234',
        capturedAt: '2026-09-09T00:00:00.000Z',
        onyx: {},
        renders: [],
        ...overrides,
    };
}

function render(name: string, renderCount: number, changedKeys: string[] = []): RenderStat {
    return {name, renderCount, totalDurationMs: renderCount * 2, changedKeys};
}

function run(onyxByKey: Record<string, OnyxKeyStat>, renders: RenderStat[] = []): FootprintRun {
    return {onyx: onyxByKey, renders, componentCount: renders.length};
}

describe('footprint comparator', () => {
    test('reports nothing when a capture is compared against itself', () => {
        const subject = capture({onyx: {[REPORT]: onyx()}, renders: [render('SelectionList', 8)]});

        expect(compareCaptures(subject, subject)).toEqual([]);
    });

    test('flags a new whole-collection subscription with no threshold to tune', () => {
        const baseline = capture({onyx: {[REPORT_ACTIONS]: onyx({rootSubscribes: 0})}});
        const candidate = capture({onyx: {[REPORT_ACTIONS]: onyx({rootSubscribes: 1})}});

        const findings = compareCaptures(baseline, candidate);

        expect(findings).toHaveLength(1);
        expect(findings.at(0).severity).toBe('flag');
        expect(findings.at(0).rule).toBe('new-whole-collection-subscription');
        expect(findings.at(0).subject).toBe('reportActions_');
    });

    test('does not flag a collection root subscription the baseline already had', () => {
        const baseline = capture({onyx: {[REPORT_ACTIONS]: onyx({rootSubscribes: 1})}});
        const candidate = capture({onyx: {[REPORT_ACTIONS]: onyx({rootSubscribes: 2})}});

        expect(compareCaptures(baseline, candidate).filter((finding) => finding.rule === 'new-whole-collection-subscription')).toEqual([]);
    });

    test('warns when notifies more than double', () => {
        const baseline = capture({onyx: {[REPORT]: onyx({notifies: 10})}});
        const candidate = capture({onyx: {[REPORT]: onyx({notifies: 21})}});

        const findings = compareCaptures(baseline, candidate);

        expect(findings).toHaveLength(1);
        expect(findings.at(0).rule).toBe('update-count');
        expect(findings.at(0).detail).toContain('10 -> 21');
    });

    test('leaves a notify count exactly at the ratio alone', () => {
        const baseline = capture({onyx: {[REPORT]: onyx({notifies: 10})}});
        const candidate = capture({onyx: {[REPORT]: onyx({notifies: 20})}});

        expect(compareCaptures(baseline, candidate)).toEqual([]);
    });

    test('warns on an extra simultaneous subscriber', () => {
        const baseline = capture({onyx: {[TRANSACTIONS]: onyx({peakConcurrent: 2})}});
        const candidate = capture({onyx: {[TRANSACTIONS]: onyx({peakConcurrent: 3})}});

        const findings = compareCaptures(baseline, candidate);

        expect(findings).toHaveLength(1);
        expect(findings.at(0).rule).toBe('peak-subscribers');
    });

    test('needs both the render ratio and the absolute delta to warn', () => {
        const baseline = capture({renders: [render('Trivial', 2), render('MoneyRequestConfirmationList', 6)]});

        // 2 -> 5 doubles the ratio but is below the absolute floor, so it stays quiet.
        const quiet = capture({renders: [render('Trivial', 5), render('MoneyRequestConfirmationList', 6)]});
        expect(compareCaptures(baseline, quiet)).toEqual([]);

        // 6 -> 19 clears both.
        const loud = capture({renders: [render('Trivial', 2), render('MoneyRequestConfirmationList', 19, ['transaction'])]});
        const findings = compareCaptures(baseline, loud);

        expect(findings).toHaveLength(1);
        expect(findings.at(0).rule).toBe('render-count');
        expect(findings.at(0).subject).toBe('MoneyRequestConfirmationList');
        expect(findings.at(0).detail).toContain('changed keys: transaction');
    });

    test('treats a component absent from the baseline as zero renders', () => {
        const baseline = capture({renders: []});
        const candidate = capture({renders: [render('BrandNewList', 12)]});

        const findings = compareCaptures(baseline, candidate);

        expect(findings).toHaveLength(1);
        expect(findings.at(0).baseline).toBe(0);
        expect(findings.at(0).detail).toContain('new');
    });

    test('sorts flags above warnings', () => {
        const baseline = capture({onyx: {[REPORT]: onyx({notifies: 10}), [REPORT_ACTIONS]: onyx()}});
        const candidate = capture({onyx: {[REPORT]: onyx({notifies: 40}), [REPORT_ACTIONS]: onyx({rootSubscribes: 1})}});

        const findings = compareCaptures(baseline, candidate);

        expect(findings.at(0).severity).toBe('flag');
        expect(findings.at(-1)?.severity).toBe('warn');
    });

    test('refuses to compare different flows or platforms', () => {
        expect(() => compareCaptures(capture(), capture({flow: 'open-report'}))).toThrow(/different flows/);
        expect(() => compareCaptures(capture(), capture({platform: 'ios'}))).toThrow(/across platforms/);
    });
});

describe('footprint aggregation', () => {
    test('takes the median, not the mean, so one outlier run cannot move the gate', () => {
        expect(median([1, 1, 1, 1, 100])).toBe(1);
        expect(median([2, 4])).toBe(3);
        expect(median([])).toBe(0);
    });

    test('counts a key missing from a run as zero rather than dropping it', () => {
        const runs = [run({[REPORT]: onyx({notifies: 10})}), run({[REPORT]: onyx({notifies: 10})}), run({})];

        // Three runs, values 10, 10 and 0: the median is 10, and the key survives.
        expect(aggregateRuns(runs).onyx[REPORT].notifies).toBe(10);

        // Two runs where it appeared once: median of 10 and 0 is 5, which is the honest answer for
        // a subscription that only happens half the time.
        expect(aggregateRuns(runs.slice(1)).onyx[REPORT].notifies).toBe(5);
    });

    test('unions changed keys across runs and sorts components by render count', () => {
        const runs = [run({}, [render('A', 4, ['policy']), render('B', 9)]), run({}, [render('A', 6, ['transaction']), render('B', 9)])];

        const {renders} = aggregateRuns(runs);

        expect(renders.map((entry) => entry.name)).toEqual(['B', 'A']);
        expect(renders.find((entry) => entry.name === 'A')?.changedKeys).toEqual(['policy', 'transaction']);
        expect(renders.find((entry) => entry.name === 'A')?.renderCount).toBe(5);
    });

    test('rejects an empty run set instead of inventing a capture', () => {
        expect(() => aggregateRuns([])).toThrow(/zero runs/);
    });
});
