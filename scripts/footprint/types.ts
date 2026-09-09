/** Shared shapes for the runtime footprint harness. */

/** Per-Onyx-key-group counts for one run, mirroring `OnyxProbeKeyStat` in the app. */
type OnyxKeyStat = {
    subscribes: number;
    unsubscribes: number;
    peakConcurrent: number;
    notifies: number;
    rootSubscribes: number;
};

/** What the in-app `onyx-probe-stop` tool returns. */
type OnyxProbeReport = {
    startedAt: number;
    durationMs: number;
    totals: OnyxKeyStat;
    byKey: Record<string, OnyxKeyStat>;
};

/** One component's aggregated render cost over a run. */
type RenderStat = {
    name: string;
    renderCount: number;
    totalDurationMs: number;
    changedKeys: string[];
};

/** Everything measured during a single replay of a flow. */
type FootprintRun = {
    onyx: Record<string, OnyxKeyStat>;
    renders: RenderStat[];

    /** Components the profiler reported before the top-N trim, for context on how much was dropped. */
    componentCount: number;
};

/** A committed baseline, or a candidate to compare against one. */
type FootprintCapture = {
    flow: string;
    platform: 'ios' | 'android';
    appId: string;
    runs: number;
    commit: string;
    capturedAt: string;

    /** Median across runs, keyed by Onyx key group. */
    onyx: Record<string, OnyxKeyStat>;

    /** Median across runs, one row per component, highest render count first. */
    renders: RenderStat[];
};

type FindingSeverity = 'flag' | 'warn';

type Finding = {
    severity: FindingSeverity;
    rule: string;
    subject: string;
    baseline: number;
    candidate: number;
    detail: string;
};

type Thresholds = {
    renderRatio: number;
    renderMinDelta: number;
    notifyRatio: number;
    peakConcurrentDelta: number;
};

const DEFAULT_THRESHOLDS: Thresholds = {
    renderRatio: 1.5,
    renderMinDelta: 5,
    notifyRatio: 2,
    peakConcurrentDelta: 1,
};

const EMPTY_ONYX_STAT: OnyxKeyStat = {
    subscribes: 0,
    unsubscribes: 0,
    peakConcurrent: 0,
    notifies: 0,
    rootSubscribes: 0,
};

export {DEFAULT_THRESHOLDS, EMPTY_ONYX_STAT};
export type {Finding, FootprintCapture, FootprintRun, OnyxKeyStat, OnyxProbeReport, RenderStat, Thresholds};
