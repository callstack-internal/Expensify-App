/**
 * Temporary instrumentation to measure the performance overhead of the useOnyx snapshot logic.
 *
 * Aggregates per-frame stats (call count + total ms) for:
 * - Snapshot path: calls where shouldUseSnapshot=true (full snapshot processing)
 * - Non-snapshot path: all other useOnyx calls (overhead of just checking isSnapshotCompatibleKey + isOnSearch)
 * - getKeyData: calls to getKeyData (selector wrapping + result extraction)
 *
 * Results are logged once per animation frame.
 *
 * To disable, set ENABLE_SNAPSHOT_METRICS = false.
 */

const ENABLE_SNAPSHOT_METRICS = true;

let snapshotTotal = 0;
let snapshotCount = 0;
let nonSnapshotTotal = 0;
let nonSnapshotCount = 0;
let getKeyDataTotal = 0;
let getKeyDataCount = 0;
let scheduled = false;

function flushMetrics() {
    if (snapshotCount > 0) {
        // eslint-disable-next-line no-console
        console.log(`[useOnyx snapshot] ${snapshotCount} calls, total: ${snapshotTotal.toFixed(3)}ms, avg: ${(snapshotTotal / snapshotCount).toFixed(3)}ms`);
    }
    if (nonSnapshotCount > 0) {
        // eslint-disable-next-line no-console
        console.log(`[useOnyx non-snapshot] ${nonSnapshotCount} calls, total: ${nonSnapshotTotal.toFixed(3)}ms, avg: ${(nonSnapshotTotal / nonSnapshotCount).toFixed(3)}ms`);
    }
    if (getKeyDataCount > 0) {
        // eslint-disable-next-line no-console
        console.log(`[useOnyx getKeyData] ${getKeyDataCount} calls, total: ${getKeyDataTotal.toFixed(3)}ms, avg: ${(getKeyDataTotal / getKeyDataCount).toFixed(3)}ms`);
    }

    snapshotTotal = 0;
    snapshotCount = 0;
    nonSnapshotTotal = 0;
    nonSnapshotCount = 0;
    getKeyDataTotal = 0;
    getKeyDataCount = 0;
    scheduled = false;
}

// eslint-disable-next-line rulesdir/prefer-early-return
function scheduleFlush() {
    if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(flushMetrics);
    }
}

function recordSnapshotCall(durationMs: number) {
    if (!ENABLE_SNAPSHOT_METRICS) {
        return;
    }
    snapshotTotal += durationMs;
    snapshotCount++;
    scheduleFlush();
}

function recordNonSnapshotCall(durationMs: number) {
    if (!ENABLE_SNAPSHOT_METRICS) {
        return;
    }
    nonSnapshotTotal += durationMs;
    nonSnapshotCount++;
    scheduleFlush();
}

function recordGetKeyDataCall(durationMs: number) {
    if (!ENABLE_SNAPSHOT_METRICS) {
        return;
    }
    getKeyDataTotal += durationMs;
    getKeyDataCount++;
    scheduleFlush();
}

export {recordSnapshotCall, recordNonSnapshotCall, recordGetKeyDataCall, ENABLE_SNAPSHOT_METRICS};
