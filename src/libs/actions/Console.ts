import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Log} from '@src/types/onyx';

let isNewAppLaunch = true;

const MAX_LOGS = 5000;
let cachedLogs: Record<string, Log> = {};

// Subscribe to logs collection to maintain cache
Onyx.connectWithoutView({
    key: ONYXKEYS.LOGS,
    callback: (logs) => {
        cachedLogs = logs ?? {};
    },
});

/**
 * Merge the new log into the existing logs in Onyx
 * @param log the log to add
 */
function addLog(log: Log) {
    const logKey = log.time.getTime().toString();

    // Check if we need to remove old logs
    const logKeys = Object.keys(cachedLogs);
    if (logKeys.length >= MAX_LOGS) {
        // Find oldest log (lowest timestamp)
        const sortedKeys = logKeys.sort((a, b) => Number(a) - Number(b));
        const oldestKey = sortedKeys[0];

        // Remove oldest log
        Onyx.merge(ONYXKEYS.LOGS, {
            [oldestKey]: null,
        });
    }

    // Add new log
    Onyx.merge(ONYXKEYS.LOGS, {
        [logKey]: log,
    });
}

/**
 * Set whether or not to store logs in Onyx
 * @param store whether or not to store logs
 */
function setShouldStoreLogs(store: boolean) {
    Onyx.set(ONYXKEYS.SHOULD_STORE_LOGS, store);
}

/**
 * Disable logging and flush the logs from Onyx
 */
function disableLoggingAndFlushLogs() {
    setShouldStoreLogs(false);
    Onyx.set(ONYXKEYS.LOGS, null);
}

/**
 * Enforces the log limit on app launch if needed,
 * while preserving logs across app sessions.
 */
function flushAllLogsOnAppLaunch() {
    if (!isNewAppLaunch) {
        return Promise.resolve();
    }

    isNewAppLaunch = false;

    // Don't clear logs - just enforce limit if needed
    return Onyx.connect({
        key: ONYXKEYS.LOGS,
        callback: (logs) => {
            if (!logs) {
                return;
            }

            const logKeys = Object.keys(logs);
            if (logKeys.length > MAX_LOGS) {
                // Prune to MAX_LOGS limit
                const sortedKeys = logKeys.sort((a, b) => Number(a) - Number(b));
                const toRemove = sortedKeys.slice(0, logKeys.length - MAX_LOGS);

                const updates = toRemove.reduce((acc, key) => {
                    acc[key] = null;
                    return acc;
                }, {} as Record<string, null>);

                Onyx.merge(ONYXKEYS.LOGS, updates);
            }
        },
        waitForCollectionCallback: true,
    });
}

export {addLog, setShouldStoreLogs, disableLoggingAndFlushLogs, flushAllLogsOnAppLaunch};
