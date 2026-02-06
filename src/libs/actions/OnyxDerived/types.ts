import type {OnyxCollection, OnyxValue} from 'react-native-onyx';
import type {NonEmptyTuple, ValueOf} from 'type-fest';
import type {OnyxCollectionKey, OnyxCollectionValuesMapping, OnyxDerivedValuesMapping, OnyxKey} from '@src/ONYXKEYS';
import type ONYXKEYS from '@src/ONYXKEYS';

type OnyxCollectionSourceValue<K extends OnyxKey> = K extends OnyxCollectionKey
    ? K extends keyof OnyxCollectionValuesMapping
        ? OnyxCollection<OnyxCollectionValuesMapping[K]>
        : never
    : never;

type DerivedSourceValues<Deps extends readonly OnyxKey[]> = Partial<{
    [K in Deps[number]]: OnyxCollectionSourceValue<K>;
}>;

type DerivedValueContext<Key extends OnyxKey, Deps extends NonEmptyTuple<Exclude<OnyxKey, Key>>> = {
    currentValue?: OnyxValue<Key>;
    sourceValues?: DerivedSourceValues<Deps>;
    areAllConnectionsSet: boolean;
};

/**
 * A derived value configuration describes:
 *  - a tuple of Onyx keys to subscribe to (dependencies),
 *  - a compute function that derives a value from the dependent Onyx values.
 *    The compute function receives a single argument that's a tuple of the onyx values for the declared dependencies.
 *    For example, if your dependencies are `['report_', 'account'], then compute will receive a [OnyxCollection<Report>, OnyxEntry<Account>]
 */
type OnyxDerivedValueConfig<Key extends ValueOf<typeof ONYXKEYS.DERIVED>, Deps extends NonEmptyTuple<Exclude<OnyxKey, Key>>> = {
    key: Key;
    dependencies: Deps;
    compute: (
        args: {
            [Index in keyof Deps]: OnyxValue<Deps[Index]>;
        },
        context: DerivedValueContext<Key, Deps>,
    ) => OnyxDerivedValuesMapping[Key];
};

type DependencyValuesTuple<Deps extends NonEmptyTuple<OnyxKey>> = {
    [Index in keyof Deps]: OnyxValue<Deps[Index]>;
};

/**
 * Extracts the item value type from a Record-based derived value.
 * For example, if the derived value is Record<string, string>, this extracts string.
 */
type LazyDerivedItemValue<Key extends ValueOf<typeof ONYXKEYS.DERIVED>> = OnyxDerivedValuesMapping[Key] extends Record<string, infer V> ? V : never;

type LazyDerivedValueContext<Key extends ValueOf<typeof ONYXKEYS.DERIVED>> = {
    currentItemValue?: LazyDerivedItemValue<Key>;
};

/**
 * A lazy derived value configuration. Unlike eager configs, lazy configs:
 *  - Do NOT compute at app startup
 *  - Set up dependency listeners only for invalidation tracking
 *  - Compute per-item on demand when explicitly requested
 *  - Cache results and only recompute when specific items are invalidated
 *
 * The Onyx value for a lazy derived key must be a Record<string, V>.
 */
type OnyxLazyDerivedValueConfig<Key extends ValueOf<typeof ONYXKEYS.DERIVED>, Deps extends NonEmptyTuple<Exclude<OnyxKey, Key>>> = {
    key: Key;
    dependencies: Deps;
    lazy: true;

    /**
     * Given a dependency change, return which item keys should be invalidated.
     * Return undefined to invalidate ALL cached items (e.g., on locale change).
     */
    getInvalidatedItems: (
        changedDependencyKey: Deps[number],
        sourceValues: DerivedSourceValues<Deps> | undefined,
        dependencyValues: DependencyValuesTuple<Deps>,
    ) => Set<string> | undefined;

    /**
     * Compute the derived value for a single item. Called on demand, not eagerly.
     */
    computeItem: (
        itemKey: string,
        args: DependencyValuesTuple<Deps>,
        context: LazyDerivedValueContext<Key>,
    ) => LazyDerivedItemValue<Key>;
};

export type {OnyxDerivedValueConfig, OnyxLazyDerivedValueConfig, DerivedValueContext, LazyDerivedValueContext, DerivedSourceValues, DependencyValuesTuple, LazyDerivedItemValue};
