import {use} from 'react';
// eslint-disable-next-line no-restricted-imports
import {useOnyx as originalUseOnyx} from 'react-native-onyx';
import {SearchSnapshotResultsContext, useSearchSnapshotContext} from '@components/Search/SearchContext';
import ONYXKEYS from '@src/ONYXKEYS';
import type {SearchResults} from '@src/types/onyx';

/**
 * Subscribe to a single entry inside the current Search snapshot.
 *
 * Replaces the pattern `useSearchSnapshotResultsContext().currentSearchResults?.data?.[key]`.
 * Reading `currentSearchResults` from context causes the consumer to re-render whenever the
 * snapshot reference flips, including:
 *   - any unrelated `data[otherKey]` slice changing (Pusher pushes inside the snapshot)
 *   - `search.isLoading` flipping when a search API call starts/finishes (no data change)
 *
 * This hook subscribes via Onyx with a selector picking only `data[key]`. Onyx deep-equals the
 * selector output, so consumers only re-render when their specific slice changes.
 *
 * For live-data (to-do) searches `currentSearchResults` is built synthetically from `useTodos()`
 * rather than from an Onyx snapshot, so the hook falls back to reading from
 * `SearchSnapshotResultsContext` in that case — done conditionally via `use()` so non-todo
 * searches don't subscribe to the heavy-churn results context.
 */
function useSearchSnapshotEntry<T>(key: string): T | undefined {
    const {currentSearchHash, shouldUseLiveData} = useSearchSnapshotContext();

    const [snapshotEntry] = originalUseOnyx(
        `${ONYXKEYS.COLLECTION.SNAPSHOT}${currentSearchHash}`,
        {
            selector: (snapshot: SearchResults | undefined) => (snapshot?.data as Record<string, unknown> | undefined)?.[key] as T | undefined,
        },
        [key],
    );

    if (shouldUseLiveData) {
        const {currentSearchResults} = use(SearchSnapshotResultsContext);
        return (currentSearchResults?.data as Record<string, unknown> | undefined)?.[key] as T | undefined;
    }

    return snapshotEntry;
}

export default useSearchSnapshotEntry;
