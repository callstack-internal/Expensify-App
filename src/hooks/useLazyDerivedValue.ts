import {useCallback, useMemo} from 'react';
import type {OnyxDerivedKey, OnyxDerivedValuesMapping} from '@src/ONYXKEYS';
import {computeLazyDerivedItem} from '@userActions/OnyxDerived/utils';
import useOnyx from './useOnyx';

/**
 * Hook that provides a lazy derived value for a specific item.
 *
 * Unlike eager derived values (which compute for all items at startup), lazy derived values
 * compute per-item on demand. The first time this hook is called for a given itemKey,
 * it triggers computation synchronously and caches the result. Subsequent calls return the
 * cached value until the item is invalidated by a dependency change.
 *
 * @param key - The Onyx derived key (must correspond to a lazy derived value config)
 * @param itemKey - The specific item key to compute (e.g., a reportID)
 * @returns The computed value for the item, or undefined if dependencies aren't ready
 */
function useLazyDerivedValue<Key extends OnyxDerivedKey>(
    key: Key,
    itemKey: string,
): OnyxDerivedValuesMapping[Key] extends Record<string, infer V> ? V | undefined : never {
    // Compute synchronously on first render (or when itemKey changes).
    // The store caches the result in memory and schedules an async Onyx write.
    const immediateValue = useMemo(() => computeLazyDerivedItem(key, itemKey), [key, itemKey]);

    // Subscribe to Onyx for reactive updates when the item is invalidated and recomputed.
    // Uses a selector to extract only this item's value, avoiding re-renders from other items.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selector = useCallback((data: any) => (data as Record<string, unknown> | undefined)?.[itemKey], [itemKey]);
    const [onyxValue] = useOnyx(key, {
        canBeMissing: true,
        selector,
    });

    // Prefer the Onyx value (reactive) but fall back to immediate value (first render).
    const value = onyxValue ?? immediateValue;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
    return value as any;
}

export default useLazyDerivedValue;
