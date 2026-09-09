import type {FootprintRun, OnyxKeyStat, RenderStat} from './types';

import {EMPTY_ONYX_STAT} from './types';

/** Median, not mean: one slow run from a GC pause or a stray Onyx write should not move the gate. */
function median(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 1) {
        return sorted.at(middle);
    }

    return (sorted.at(middle - 1) + sorted.at(middle)) / 2;
}

/** Rounds to one decimal so a median of two integer runs does not print as 6.500000000000001. */
function round(value: number): number {
    return Math.round(value * 10) / 10;
}

function medianOnyx(runs: FootprintRun[]): Record<string, OnyxKeyStat> {
    const keys = new Set(runs.flatMap((run) => Object.keys(run.onyx)));
    const result: Record<string, OnyxKeyStat> = {};

    for (const key of [...keys].sort()) {
        // A key missing from a run counts as zero. A subscription that only happens sometimes is
        // worth seeing, and dropping the run from the set would hide it.
        const stats = runs.map((run) => run.onyx[key] ?? EMPTY_ONYX_STAT);

        result[key] = {
            subscribes: round(median(stats.map((stat) => stat.subscribes))),
            unsubscribes: round(median(stats.map((stat) => stat.unsubscribes))),
            peakConcurrent: round(median(stats.map((stat) => stat.peakConcurrent))),
            notifies: round(median(stats.map((stat) => stat.notifies))),
            rootSubscribes: round(median(stats.map((stat) => stat.rootSubscribes))),
        };
    }

    return result;
}

function medianRenders(runs: FootprintRun[]): RenderStat[] {
    const names = new Set(runs.flatMap((run) => run.renders.map((render) => render.name)));
    const result: RenderStat[] = [];

    for (const name of names) {
        const stats = runs.map((run) => run.renders.find((render) => render.name === name));
        const changedKeys = new Set(stats.flatMap((stat) => stat?.changedKeys ?? []));

        result.push({
            name,
            renderCount: round(median(stats.map((stat) => stat?.renderCount ?? 0))),
            totalDurationMs: round(median(stats.map((stat) => stat?.totalDurationMs ?? 0))),
            changedKeys: [...changedKeys].sort(),
        });
    }

    return result.sort((a, b) => b.renderCount - a.renderCount || a.name.localeCompare(b.name));
}

/** Collapses N runs of the same flow into one comparable set of medians. */
function aggregateRuns(runs: FootprintRun[]): {onyx: Record<string, OnyxKeyStat>; renders: RenderStat[]} {
    if (runs.length === 0) {
        throw new Error('Cannot aggregate zero runs.');
    }

    return {onyx: medianOnyx(runs), renders: medianRenders(runs)};
}

export {aggregateRuns, median};
