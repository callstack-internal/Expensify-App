import type {OnyxCollectionKey, OnyxCollectionValuesMapping, OnyxDerivedValuesMapping, OnyxKey} from '@src/ONYXKEYS';
import type ONYXKEYS from '@src/ONYXKEYS';

import type {OnyxCollection, OnyxValue} from 'react-native-onyx';
import type {NonEmptyTuple, ValueOf} from 'type-fest';

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
    // The dependency keys that fired since the last flush. Unlike `sourceValues` (which only holds
    // non-empty deltas), this reflects every dependency that triggered — including a scalar cleared to
    // `undefined` or a collection with no changed members — so trigger-detection can't miss a fire.
    triggeredKeys?: Set<OnyxKey>;
    // Set on the one-off pass the engine schedules after a value is restored from disk (see
    // `shouldFullRecomputeAfterRestore`). The config has to recompute from its dependencies instead of
    // trusting `currentValue` or waiting for deltas, because the changes this pass exists to catch left
    // no deltas behind.
    shouldFullRecompute?: boolean;
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

    /**
     * Optional hook to reset any module-level state the config keeps across computes (e.g. `previous*`
     * baselines/maps). The engine calls it when Onyx is cleared, so the next
     * compute starts from scratch instead of diffing rehydrated data against pre-clear state.
     */
    onReset?: () => void;

    /**
     * When true, the engine schedules one full recompute (`shouldFullRecompute` on the context) shortly
     * after a value restored from disk is first used.
     *
     * A restored value was computed against the data that existed when it was persisted, and dependencies
     * keep changing while this key isn't computing: the app can be closed while push notifications apply
     * data headlessly, and a compute can be gated on something that isn't ready yet (`reportAttributes`
     * waits for translations, which only load once the UI mounts). Those changes produce no deltas, and
     * the first flush baselines them as already-processed — so a config that treats "no deltas" as
     * "nothing to do" would serve the restored value for the rest of the session.
     *
     * Only set this on such configs. The ones that rebuild from scratch whenever they get no deltas
     * already recover on their own.
     */
    shouldFullRecomputeAfterRestore?: boolean;
};

export type {OnyxDerivedValueConfig, DerivedValueContext};
