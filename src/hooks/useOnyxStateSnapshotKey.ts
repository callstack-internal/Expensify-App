// Lets useOnyxState selectors read from the same Search snapshot that @hooks/useOnyx redirects to.
import {SearchQueryContext, SearchResultsContext} from '@components/Search/SearchContext';
import {useIsOnSearch} from '@components/Search/SearchScopeProvider';

import ONYXKEYS from '@src/ONYXKEYS';

import type {OnyxKey, OnyxValue} from 'react-native-onyx';

import {use} from 'react';

type SnapshotKey = `${typeof ONYXKEYS.COLLECTION.SNAPSHOT}${number}`;

/**
 * Returns the Search snapshot key that `@hooks/useOnyx` would read snapshot-compatible keys from, or undefined when
 * live data is used. `useOnyxState` selectors pass it to `getSnapshotAwareValue` to keep the same data source.
 */
function useOnyxStateSnapshotKey(): SnapshotKey | undefined {
    const isOnSearch = useIsOnSearch();
    const {currentSearchHash} = use(SearchQueryContext);
    const {shouldUseLiveData} = use(SearchResultsContext);
    if (!isOnSearch || !currentSearchHash || shouldUseLiveData) {
        return undefined;
    }
    return `${ONYXKEYS.COLLECTION.SNAPSHOT}${currentSearchHash}`;
}

/** Only for snapshot-compatible member keys (report, report actions, policy, transaction...). */
function getSnapshotAwareValue<TKey extends OnyxKey>(state: {readonly [K in TKey | SnapshotKey]: OnyxValue<K>}, snapshotKey: SnapshotKey | undefined, key: TKey): OnyxValue<TKey> {
    if (!snapshotKey) {
        return state[key];
    }
    // The snapshot's data holds the same keys and value types as live Onyx, but TypeScript can't link them through the generic key
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return state[snapshotKey]?.data?.[key as keyof NonNullable<OnyxValue<SnapshotKey>>['data']] as OnyxValue<TKey>;
}

export default useOnyxStateSnapshotKey;
export {getSnapshotAwareValue};
export type {SnapshotKey};
