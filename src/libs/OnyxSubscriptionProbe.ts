import ONYXKEYS from '@src/ONYXKEYS';

import type {Connection, ConnectOptions, OnyxKey} from 'react-native-onyx';

import connectionManager from 'react-native-onyx/dist/OnyxConnectionManager';

/**
 * Dev-only probe that counts Onyx subscription activity while a flow runs.
 *
 * `useOnyx()` and `Onyx.connectWithoutView()` both subscribe through the single
 * `OnyxConnectionManager` instance, so wrapping its `connect`/`disconnect` and the
 * per-subscriber callback covers every subscription path without touching app code.
 *
 * A notify is the connection manager invoking a subscriber's callback because a key it
 * watches changed. That is an upper bound on re-renders: `useOnyx` runs its own equality
 * check and any selector afterwards, and often bails out. Read the counts as how often a
 * subscriber was woken, not how often it rendered.
 *
 * Inert until `startOnyxProbe()` is called.
 */

type OnyxProbeKeyStat = {
    /** How many subscribers connected to this key group while the probe ran */
    subscribes: number;

    /** How many of those subscribers disconnected before the probe stopped */
    unsubscribes: number;

    /** The highest number of simultaneously connected subscribers seen for this key group */
    peakConcurrent: number;

    /** How many times a subscriber callback for this key group was fired */
    notifies: number;

    /**
     * How many of the subscribes were to a collection's root key rather than one member. A root
     * subscriber is notified for every member change in the collection.
     */
    rootSubscribes: number;
};

type OnyxProbeReport = {
    /** `Date.now()` when the probe started */
    startedAt: number;

    /** How long the probe ran */
    durationMs: number;

    /** Roll-up across every key group */
    totals: OnyxProbeKeyStat;

    /** Per-key-group counts, collection members grouped under their collection prefix */
    byKey: Record<string, OnyxProbeKeyStat>;
};

/** Collection prefixes, longest first, so `reportActions_` wins over any shorter prefix it contains */
const COLLECTION_PREFIXES: string[] = Object.values(ONYXKEYS.COLLECTION).sort((a: string, b: string) => b.length - a.length);

type ConnectionManagerConnect = typeof connectionManager.connect;
type ConnectionManagerDisconnect = typeof connectionManager.disconnect;

/** The subscriber callback for a given key, with the conditional collection/single-value signature already resolved */
type ConnectCallback<TKey extends OnyxKey> = NonNullable<ConnectOptions<TKey>['callback']>;

let originalConnect: ConnectionManagerConnect | undefined;
let originalDisconnect: ConnectionManagerDisconnect | undefined;
let startedAt = 0;
let stats: Record<string, OnyxProbeKeyStat> = {};
let liveCountByKey: Record<string, number> = {};

/** Tracks which key group a live subscriber belongs to, so `disconnect` can be attributed */
let keyBySubscriber = new Map<string, string>();

/**
 * Collapses a collection member key onto its prefix (`report_123` -> `report_`), so per-member
 * noise does not bury the signal. Non-collection keys are returned as-is.
 */
function normalizeKey(key: OnyxKey): string {
    for (const prefix of COLLECTION_PREFIXES) {
        if (key.startsWith(prefix)) {
            return prefix;
        }
    }
    return key;
}

function getStat(key: string): OnyxProbeKeyStat {
    if (!stats[key]) {
        stats[key] = {subscribes: 0, unsubscribes: 0, peakConcurrent: 0, notifies: 0, rootSubscribes: 0};
    }
    return stats[key];
}

/** True when the subscriber asked for a whole collection rather than one member of it. */
function isCollectionRootKey(key: OnyxKey): boolean {
    return COLLECTION_PREFIXES.includes(key);
}

function getSubscriberID(connection: Connection): string {
    return `${connection.id}#${connection.callbackID}`;
}

function isOnyxProbeRunning(): boolean {
    return !!originalConnect;
}

/** Starts counting, discarding any previous run's counts. Calling it twice is a no-op. */
function startOnyxProbe(): void {
    if (isOnyxProbeRunning()) {
        return;
    }

    startedAt = Date.now();
    stats = {};
    liveCountByKey = {};
    keyBySubscriber = new Map();

    // `OnyxConnectionManager` binds `connect`/`disconnect` to the instance in its constructor
    // (lodash `bindAll`), so reading them off the singleton keeps the correct `this`.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const baseConnect: ConnectionManagerConnect = connectionManager.connect;
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const baseDisconnect: ConnectionManagerDisconnect = connectionManager.disconnect;
    originalConnect = baseConnect;
    originalDisconnect = baseDisconnect;

    connectionManager.connect = <TKey extends OnyxKey>(connectOptions: ConnectOptions<TKey>): Connection => {
        const normalizedKey = normalizeKey(connectOptions.key);
        const stat = getStat(normalizedKey);
        stat.subscribes++;
        if (isCollectionRootKey(connectOptions.key)) {
            stat.rootSubscribes++;
        }

        const liveCount = (liveCountByKey[normalizedKey] ?? 0) + 1;
        liveCountByKey[normalizedKey] = liveCount;
        stat.peakConcurrent = Math.max(stat.peakConcurrent, liveCount);

        const {callback} = connectOptions;
        let instrumentedOptions = connectOptions;
        if (callback) {
            const instrumentedCallback: ConnectCallback<TKey> = (...args) => {
                stat.notifies++;
                callback(...args);
            };
            instrumentedOptions = {...connectOptions, callback: instrumentedCallback};
        }

        const connection = baseConnect(instrumentedOptions);
        keyBySubscriber.set(getSubscriberID(connection), normalizedKey);
        return connection;
    };

    connectionManager.disconnect = (connection: Connection): void => {
        const subscriberID = getSubscriberID(connection);
        const normalizedKey = keyBySubscriber.get(subscriberID);

        // A subscriber that connected before the probe started has nothing to attribute.
        if (normalizedKey) {
            keyBySubscriber.delete(subscriberID);
            getStat(normalizedKey).unsubscribes++;
            liveCountByKey[normalizedKey] = Math.max(0, (liveCountByKey[normalizedKey] ?? 0) - 1);
        }

        baseDisconnect(connection);
    };
}

/** Builds the report for the current counts without unwrapping the connection manager. */
function getOnyxProbeReport(): OnyxProbeReport {
    const byKey = Object.fromEntries(Object.entries(stats).sort(([, a], [, b]) => b.notifies - a.notifies));

    const totals = Object.values(stats).reduce(
        (accumulator, stat) => ({
            subscribes: accumulator.subscribes + stat.subscribes,
            unsubscribes: accumulator.unsubscribes + stat.unsubscribes,
            notifies: accumulator.notifies + stat.notifies,
            rootSubscribes: accumulator.rootSubscribes + stat.rootSubscribes,
            peakConcurrent: Math.max(accumulator.peakConcurrent, stat.peakConcurrent),
        }),
        {subscribes: 0, unsubscribes: 0, notifies: 0, rootSubscribes: 0, peakConcurrent: 0},
    );

    return {startedAt, durationMs: Date.now() - startedAt, totals, byKey};
}

/** Stops counting, restores the connection manager, and returns the report. */
function stopOnyxProbe(): OnyxProbeReport {
    const report = getOnyxProbeReport();

    if (originalConnect) {
        connectionManager.connect = originalConnect;
        originalConnect = undefined;
    }
    if (originalDisconnect) {
        connectionManager.disconnect = originalDisconnect;
        originalDisconnect = undefined;
    }

    return report;
}

export {getOnyxProbeReport, isOnyxProbeRunning, startOnyxProbe, stopOnyxProbe};
export type {OnyxProbeReport};
