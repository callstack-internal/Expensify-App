import type {FootprintCapture, Finding, Thresholds} from './types';

import {DEFAULT_THRESHOLDS, EMPTY_ONYX_STAT} from './types';

// Pure ratio and set comparisons. No clock, no filesystem, no network, so all of it unit-tests.

function ratio(baseline: number, candidate: number): number {
    if (baseline === 0) {
        return candidate === 0 ? 1 : Number.POSITIVE_INFINITY;
    }

    return candidate / baseline;
}

function formatRatio(value: number): string {
    return Number.isFinite(value) ? `${value.toFixed(2)}x` : 'new';
}

/** Rule 1: a component committing more often than it used to. */
function compareRenders(baseline: FootprintCapture, candidate: FootprintCapture, thresholds: Thresholds): Finding[] {
    const findings: Finding[] = [];

    for (const render of candidate.renders) {
        const before = baseline.renders.find((entry) => entry.name === render.name)?.renderCount ?? 0;
        const delta = render.renderCount - before;
        const change = ratio(before, render.renderCount);

        // Both conditions, because a 2 -> 4 jump doubles the ratio and costs nothing.
        if (change <= thresholds.renderRatio || delta <= thresholds.renderMinDelta) {
            continue;
        }

        const keys = render.changedKeys.length > 0 ? ` changed keys: ${render.changedKeys.join(', ')}` : '';

        findings.push({
            severity: 'warn',
            rule: 'render-count',
            subject: render.name,
            baseline: before,
            candidate: render.renderCount,
            detail: `commits ${before} -> ${render.renderCount} (${formatRatio(change)}).${keys}`,
        });
    }

    return findings;
}

/** Rules 2 to 4, all keyed on Onyx key groups. */
function compareOnyx(baseline: FootprintCapture, candidate: FootprintCapture, thresholds: Thresholds): Finding[] {
    const findings: Finding[] = [];

    for (const [key, stat] of Object.entries(candidate.onyx)) {
        const before = baseline.onyx[key] ?? EMPTY_ONYX_STAT;

        // Rule 4 first. It needs no threshold: a whole-collection subscriber wakes on every member.
        if (stat.rootSubscribes > 0 && before.rootSubscribes === 0) {
            findings.push({
                severity: 'flag',
                rule: 'new-whole-collection-subscription',
                subject: key,
                baseline: 0,
                candidate: stat.rootSubscribes,
                detail: `${stat.rootSubscribes} subscriber(s) now watch the whole "${key}" collection, where the baseline had none. Every member change notifies them.`,
            });
        }

        const notifyChange = ratio(before.notifies, stat.notifies);
        if (notifyChange > thresholds.notifyRatio && stat.notifies > 0) {
            findings.push({
                severity: 'warn',
                rule: 'update-count',
                subject: key,
                baseline: before.notifies,
                candidate: stat.notifies,
                detail: `updates ${before.notifies} -> ${stat.notifies} (${formatRatio(notifyChange)}).`,
            });
        }

        const peakDelta = stat.peakConcurrent - before.peakConcurrent;
        if (peakDelta >= thresholds.peakConcurrentDelta) {
            findings.push({
                severity: 'warn',
                rule: 'peak-subscribers',
                subject: key,
                baseline: before.peakConcurrent,
                candidate: stat.peakConcurrent,
                detail: `simultaneous subscribers ${before.peakConcurrent} -> ${stat.peakConcurrent}.`,
            });
        }
    }

    return findings;
}

const SEVERITY_ORDER: Record<Finding['severity'], number> = {flag: 0, warn: 1};

function compareCaptures(baseline: FootprintCapture, candidate: FootprintCapture, thresholds: Thresholds = DEFAULT_THRESHOLDS): Finding[] {
    if (baseline.flow !== candidate.flow) {
        throw new Error(`Refusing to compare different flows: baseline is "${baseline.flow}", candidate is "${candidate.flow}".`);
    }

    if (baseline.platform !== candidate.platform) {
        throw new Error(`Refusing to compare across platforms: baseline is ${baseline.platform}, candidate is ${candidate.platform}.`);
    }

    return [...compareOnyx(baseline, candidate, thresholds), ...compareRenders(baseline, candidate, thresholds)].sort(
        (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.candidate - b.baseline - (a.candidate - a.baseline) || a.subject.localeCompare(b.subject),
    );
}

export {compareCaptures};
