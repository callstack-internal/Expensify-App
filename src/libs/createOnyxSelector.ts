// Measurement-only prototype (expensify-issues#3041), not for merge. reselect5 is reselect@5.1.1 copied into node_modules locally:
// `npm pack reselect@5.1.1 && tar xzf reselect-5.1.1.tgz && cp -R package node_modules/reselect5`
import {weakMapMemoize} from 'reselect5';

/** The local stats flag file sets this from localStorage, so one build can run both sides of the A/B. */
function isSharedSelectorsEnabled(): boolean {
    return (globalThis as {__ONYX_SHARED_SELECTORS__?: boolean}).__ONYX_SHARED_SELECTORS__ === true;
}

/**
 * Wraps a selector in a module-level memo shared by every hook instance, keyed on the input refs and any extra args,
 * so N consumers of the same snapshot compute once instead of N times.
 */
function createOnyxSelector<TArgs extends unknown[], TResult>(combiner: (...args: TArgs) => TResult): (...args: TArgs) => TResult {
    const memoized = weakMapMemoize(combiner);
    const selector = (...args: TArgs): TResult => (isSharedSelectorsEnabled() ? memoized(...args) : combiner(...args));
    // Keep the original name so selector stats line up across both sides of the A/B.
    Object.defineProperty(selector, 'name', {value: combiner.name});
    return selector;
}

export default createOnyxSelector;
