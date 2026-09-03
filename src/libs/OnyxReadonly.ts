import type {OnyxKey, OnyxValue} from 'react-native-onyx';
import type {ReadonlyDeep} from 'type-fest';

import OnyxLib from 'react-native-onyx';

/**
 * The value `Onyx.get()` really hands back: the cached object itself, shared with every other reader of
 * that key. Typing it deeply read-only is what turns the "the result of `Onyx.get()` MUST NOT be mutated"
 * convention into a rule the compiler enforces instead of a comment reviewers have to remember.
 */
type OnyxReadonlyValue<TKey extends OnyxKey> = ReadonlyDeep<OnyxValue<TKey>>;

/**
 * Local experiment for the Onyx immutability audit (https://github.com/Expensify/App/issues/71206).
 *
 * `Onyx.get()` re-typed so a one-shot read can only produce read-only data. Runtime is untouched: this is
 * the same `Onyx` object with a narrower type on one method, so nothing about behaviour, cache identity or
 * bundle size changes. It lives in the app rather than in the library so the cost can be measured on real
 * call sites before it is proposed as the library's own signature.
 *
 * `get()` is deliberately the only method touched. It is the read whose result reaches the fewest places, and
 * the one whose contract already says the value must not be mutated. The rest of the API is left alone:
 *
 * - `useOnyx()` hands back the same shared object, but its result flows through render and hundreds of props.
 *   Typing it read-only costs 303 errors in 165 files shallow, or 2421 in 731 deep, the latter including
 *   ~110 that no signature change can fix (`ReadonlyDeep` breaks the shape of `ReportAction['message']`).
 * - The writers keep their mutable input types. Widening them to accept read-only data would cost 23 errors
 *   in 6 files and would let a value read with `get()` be written straight back, but it is a separate change
 *   and does not have to land first. Until it does, a caller that reads with `get()` and writes the same
 *   value back rebuilds the mutable parts itself.
 */
// The cast is the whole point of the file: the same object, with a narrower type on one method. There is no
// expression TypeScript can check here, because `Promise<OnyxValue<TKey>>` and
// `Promise<ReadonlyDeep<OnyxValue<TKey>>>` are not comparable while `TKey` is still generic.
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
const OnyxReadonly = OnyxLib as Omit<typeof OnyxLib, 'get'> & {
    get: <TKey extends OnyxKey>(key: TKey) => Promise<OnyxReadonlyValue<TKey>>;
};

export default OnyxReadonly;
export type {OnyxReadonlyValue};
