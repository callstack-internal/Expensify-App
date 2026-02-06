import Onyx from 'react-native-onyx';
import type {OnyxInput} from 'react-native-onyx';
import OnyxUtils from 'react-native-onyx/dist/OnyxUtils';
import type {NonEmptyTuple, ValueOf} from 'type-fest';
import Log from '@libs/Log';
import type {OnyxDerivedKey, OnyxKey} from '@src/ONYXKEYS';
import type ONYXKEYS from '@src/ONYXKEYS';
import type {DependencyValuesTuple, DerivedSourceValues, LazyDerivedValueContext, OnyxLazyDerivedValueConfig} from './types';

/**
 * Manages the lifecycle of a single lazy derived value:
 * - Tracks dependency values via Onyx listeners (for invalidation only)
 * - Maintains a set of invalidated item keys
 * - Computes item values on demand and caches them
 * - Flushes dirty items to Onyx in batches
 */
class LazyDerivedValueStore<Key extends ValueOf<typeof ONYXKEYS.DERIVED>, Deps extends NonEmptyTuple<Exclude<OnyxKey, Key>>> {
    private config: OnyxLazyDerivedValueConfig<Key, Deps>;

    private dependencyValues: DependencyValuesTuple<Deps>;

    private cachedValues: Record<string, unknown> = {};

    private invalidatedItems = new Set<string>();

    private allInvalid = true;

    private dirtyItems = new Set<string>();

    private flushScheduled = false;

    private areAllConnectionsSet = false;

    /** Items requested before all connections were established. Will be computed once ready. */
    private pendingItems = new Set<string>();

    constructor(config: OnyxLazyDerivedValueConfig<Key, Deps>) {
        this.config = config;
        this.dependencyValues = new Array(config.dependencies.length) as DependencyValuesTuple<Deps>;
    }

    /**
     * Initialize the store: restore cached values from disk and set up dependency listeners.
     */
    initialize(): void {
        const {key, dependencies} = this.config;
        const totalConnections = dependencies.length;
        let connectionsEstablishedCount = 0;
        const connectionInitializedFlags = new Array(totalConnections).fill(false);

        OnyxUtils.get(key).then((storedValue) => {
            if (storedValue && typeof storedValue === 'object') {
                this.cachedValues = storedValue as Record<string, unknown>;
                // Mark all items as stale since dependencies may have changed while app was closed
                this.allInvalid = true;
                Log.info(`[OnyxDerived] Lazy derived value for ${key} restored from disk (${Object.keys(this.cachedValues).length} items, all marked stale)`);
            }

            const checkAndMarkConnectionInitialized = (index: number) => {
                if (connectionInitializedFlags.at(index)) {
                    return;
                }
                connectionInitializedFlags[index] = true;
                connectionsEstablishedCount++;
                if (connectionsEstablishedCount === totalConnections) {
                    this.areAllConnectionsSet = true;
                    Log.info(`[OnyxDerived] All connections initialized for lazy key: ${key}`);
                    this.computePendingItems();
                }
            };

            for (let i = 0; i < dependencies.length; i++) {
                const depIndex = i;
                const depKey = dependencies[depIndex];

                if (OnyxUtils.isCollectionKey(depKey)) {
                    Onyx.connectWithoutView({
                        key: depKey,
                        waitForCollectionCallback: true,
                        callback: (value, _collectionKey, sourceValue) => {
                            checkAndMarkConnectionInitialized(depIndex);
                            this.setDependencyValue(depIndex, value as DependencyValuesTuple<Deps>[number]);
                            this.onDependencyChanged(depKey, sourceValue ? ({[depKey]: sourceValue} as DerivedSourceValues<Deps>) : undefined);
                        },
                    });
                } else {
                    Onyx.connectWithoutView({
                        key: depKey,
                        callback: (value) => {
                            checkAndMarkConnectionInitialized(depIndex);
                            this.setDependencyValue(depIndex, value as DependencyValuesTuple<Deps>[number]);
                            this.onDependencyChanged(depKey, undefined);
                        },
                    });
                }
            }
        });
    }

    /**
     * Called when a dependency changes. Determines which items to invalidate.
     */
    private onDependencyChanged(changedKey: Deps[number], sourceValues: DerivedSourceValues<Deps> | undefined): void {
        if (!this.areAllConnectionsSet) {
            return;
        }

        const invalidated = this.config.getInvalidatedItems(changedKey, sourceValues, this.dependencyValues);

        if (invalidated === undefined) {
            // Invalidate all items
            this.allInvalid = true;
            this.invalidatedItems.clear();
            Log.info(`[OnyxDerived] Lazy key ${this.config.key}: all items invalidated due to ${String(changedKey)} change`);
        } else {
            for (const itemKey of invalidated) {
                this.invalidatedItems.add(itemKey);
            }
            if (invalidated.size > 0) {
                Log.info(`[OnyxDerived] Lazy key ${this.config.key}: ${invalidated.size} items invalidated due to ${String(changedKey)} change`);
            }
        }

        // Recompute cached items that are now stale so useOnyx subscribers get updated values
        this.recomputeStaleCachedItems();
    }

    /**
     * Compute all items that were requested before connections were ready.
     */
    private computePendingItems(): void {
        if (this.pendingItems.size === 0) {
            return;
        }
        Log.info(`[OnyxDerived] Computing ${this.pendingItems.size} pending items for lazy key ${this.config.key}`);
        for (const itemKey of this.pendingItems) {
            this.computeAndCacheItem(itemKey);
        }
        this.pendingItems.clear();
    }

    /**
     * Recompute all cached items that are currently stale and flush to Onyx.
     * Called after invalidation so that useOnyx subscribers get updated values.
     */
    private recomputeStaleCachedItems(): void {
        const wasAllInvalid = this.allInvalid;
        const keysToRecompute: string[] = [];
        if (wasAllInvalid) {
            keysToRecompute.push(...Object.keys(this.cachedValues));
        } else {
            for (const itemKey of this.invalidatedItems) {
                if (itemKey in this.cachedValues) {
                    keysToRecompute.push(itemKey);
                }
            }
        }

        if (keysToRecompute.length === 0) {
            return;
        }

        Log.info(`[OnyxDerived] Recomputing ${keysToRecompute.length} stale cached items for lazy key ${this.config.key}`);
        for (const itemKey of keysToRecompute) {
            this.computeAndCacheItem(itemKey);
        }

        // Reset allInvalid after recomputing all cached items
        if (wasAllInvalid) {
            this.allInvalid = false;
        }
    }

    /**
     * Check if an item needs recomputation.
     */
    private isItemStale(itemKey: string): boolean {
        return this.allInvalid || this.invalidatedItems.has(itemKey);
    }

    /**
     * Compute and cache the value for a single item. Returns the computed value.
     * If the item is already cached and not stale, returns the cached value.
     */
    computeAndCacheItem(itemKey: string): unknown {
        if (!this.areAllConnectionsSet) {
            this.pendingItems.add(itemKey);
            return this.cachedValues[itemKey];
        }

        if (!this.isItemStale(itemKey) && itemKey in this.cachedValues) {
            return this.cachedValues[itemKey];
        }

        const context: LazyDerivedValueContext<Key> = {
            currentItemValue: this.cachedValues[itemKey] as LazyDerivedValueContext<Key>['currentItemValue'],
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const result = (this.config.computeItem as any)(itemKey, this.dependencyValues, context);

        this.cachedValues[itemKey] = result;
        this.invalidatedItems.delete(itemKey);
        this.dirtyItems.add(itemKey);

        this.scheduleFlush();

        return result;
    }

    /**
     * Get the cached value for an item without triggering computation.
     */
    getCachedItem(itemKey: string): unknown {
        return this.cachedValues[itemKey];
    }

    private setDependencyValue<Index extends number>(i: Index, value: DependencyValuesTuple<Deps>[Index]): void {
        this.dependencyValues[i] = value;
    }

    /**
     * Schedule a debounced flush of dirty items to Onyx.
     */
    private scheduleFlush(): void {
        if (this.flushScheduled) {
            return;
        }
        this.flushScheduled = true;

        // Use queueMicrotask to batch multiple computations within the same tick
        queueMicrotask(() => {
            this.flushToOnyx();
            this.flushScheduled = false;
        });
    }

    /**
     * Write all dirty items to Onyx using Onyx.set with skipCacheCheck,
     * consistent with how eager derived values are written.
     */
    private flushToOnyx(): void {
        if (this.dirtyItems.size === 0) {
            return;
        }

        Log.info(`[OnyxDerived] Flushing ${this.dirtyItems.size} dirty items for lazy key ${this.config.key}`);
        this.dirtyItems.clear();

        Onyx.set(this.config.key as OnyxDerivedKey, this.cachedValues as OnyxInput<OnyxDerivedKey>, {
            skipCacheCheck: true,
        });
    }
}

/**
 * Global registry of lazy derived value stores, keyed by their Onyx key.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lazyStores = new Map<string, LazyDerivedValueStore<any, any>>();

/**
 * Initialize a lazy derived value config. Sets up listeners for invalidation only.
 */
function initLazyDerivedValue<Key extends ValueOf<typeof ONYXKEYS.DERIVED>, Deps extends NonEmptyTuple<Exclude<OnyxKey, Key>>>(
    config: OnyxLazyDerivedValueConfig<Key, Deps>,
): void {
    const store = new LazyDerivedValueStore(config);
    lazyStores.set(config.key, store);
    store.initialize();
}

/**
 * Compute and cache a lazy derived value for a specific item.
 * Returns the computed (or cached) value synchronously.
 * Called by the useLazyDerivedValue hook or imperatively from action code.
 */
function computeLazyDerivedItem(key: OnyxDerivedKey, itemKey: string): unknown {
    const store = lazyStores.get(key);
    if (!store) {
        Log.warn(`[OnyxDerived] No lazy store found for key: ${key}`);
        return undefined;
    }
    return store.computeAndCacheItem(itemKey);
}

export {LazyDerivedValueStore, initLazyDerivedValue, computeLazyDerivedItem};
