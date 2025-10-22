## How other state management libraries handle immutability

The table below demonstrates some popular state management libraries and how they treat immutability:

| Library                    | Default state mutability                     | Mutation allowed at runtime                         | Runtime immutability protection          | Change detection mechanism              | TypeScript immutability enforcement                   | Best practice                                                       |
|---------------------------|----------------------------------------------|-----------------------------------------------------|------------------------------------------|------------------------------------------|--------------------------------------------------------|----------------------------------------------------------------------|
| React (useState / useReducer) | ❌ Mutable (must be treated immutably)    | ⚠️ Yes (may break re-render)                        | ❌ None                                  | Shallow reference equality               | ⚠️ Partial — can use `Readonly<T>`                    | Avoid mutation, create new objects                                 |
| Redux (plain)             | ❌ Mutable (must be treated immutably)        | ⚠️ Yes (may break re-render)                         | ⚠️ Optional dev middleware               | Reference equality                      | ⚠️ Partial — TS doesn’t block mutation               | Always return new objects                                          |
| Redux Toolkit (RTK)       | ✅ Immutable (via Immer)                      | ❌ No (Immer proxies safely)                         | ✅ Immer Proxy in reducers               | Structural sharing via Immer            | ✅ Strong — types + Immer ensure safety             | “Mutate” safely inside reducers                                     |
| MobX                      | ✅ Mutable (by design)                        | ✅ Yes (mutations are tracked)                      | ❌ None                                  | Proxy-based observables                 | ❌ None                                               | Mutate directly; MobX tracks updates                               |
| Zustand                   | ⚠️ Mutable (optional Immer)                   | ✅ Yes (mutates store directly)                     | ⚠️ Optional middleware (`immer`)         | Shallow equality / selector-based       | ⚠️ Partial — can use `Readonly<T>` or Immer         | Optional immutability; can use Immer                               |
| React Query               | ⚠️ Mutable JS objects (should treat immutably) | ⚠️ Yes (developer discipline)                       | ❌ None                                  | Reference equality                      | ⚠️ Weak — TS types, but no immutability enforcement | Always update cache immutably via `setQueryData`                   |

### Overview of all the libraries

| Level                                             | Libraries                         | Description                                    |
|--------------------------------------------------|-----------------------------------|------------------------------------------------|
| 🟢 Immutable by runtime & TS                     | Redux Toolkit                     | Safe by design (Immer + TS)                    |
| 🟡 Immutable by convention / optional TS help     | React, Redux, Zustand, React Query | You must follow discipline; TS can help optionally |
| 🔴 Mutable by design (no TS protection)           | MobX                              | Mutation is expected and tracked               |

### Conclusions

Most state management libraries **don't have built-in protections against** immutability, instead letting the developer decide and care about it, sometimes with the help of middlewares which can enforce it (e.g. Redux or Zustand).  

## Adding immutability to Onyx

### Using [immer.js](https://immerjs.github.io/immer/)

On [this branch](https://github.com/callstack-internal/react-native-onyx/tree/eliran/immutability-immer) there is a sample of a way to implement [immer.js](http://immer.js) in Onyx codebase.

**Performance comparison:**

When adding it in _fastMerge_ there's significantly worse performance over the current implementation.

I ran it in our _perf-test_ and this is the results taken from _current.perf_ after running the tests:  
<br/>{"name":"utils fastMerge one call with current implementation","type":"function","runs":10,"meanDuration":**2.7215091111089955**,"stdevDuration":0.05189331658530679,"durations":\[2.805958000011742,2.73741699999664,2.6552080000110436,2.737833999999566,2.7754579999891575,2.6538329999893904,2.739332999990438,2.6841659999918193,2.704375000001164\],"warmupDurations":\[2.8848330000037095\],"outlierDurations":\[4.22516600000381\],"meanCount":1,"stdevCount":0,"counts":\[1,1,1,1,1,1,1,1,1,1\]}

{"name":"utils fastMerge one call with Immer implementation","type":"function","runs":10,"meanDuration":**30.018466600001556**,"stdevDuration":0.5998225312078885,"durations":\[29.786833999998635,30.700333000000683,29.732499999998254,30.31533300000592,29.043583000006038,30.464042000006884,29.8559580000001,30.675583000003826,29.15274999999383,30.457750000001397\],"warmupDurations":\[56.20929199999955\],"outlierDurations":\[\],"meanCount":1,"stdevCount":0,"counts":\[1,1,1,1,1,1,1,1,1,1\]

Difference is around **12x** slower when using _fastMerge_ with immerjs.

This is a test of a very big array, of adding 1000 items to an array of 500 items.

Based on this there is few possibility to consider

- Use it by default and get much worse performance for better state handling and potentially less bugs due to mutability.
- Not using it and letting the developer decide.

### Adding TypeScript enforcement to make Onyx return only _readOnly_ values

Implementation in 0nyx codebase in [this branch](https://github.com/callstack-internal/react-native-onyx/tree/eliran/typescript-readonly).

To test the implementation on E/App you can use [this branch](https://github.com/callstack-internal/Expensify-App/tree/eliran/typesceipt-readonly-onyx).

**When using it in E/App there's 2177 ts errors in 495 files.**

Further investigation ideas:

- Is it worth it to try and fix some of those errors in readonly and this way enforce immutability without affecting performance e.g adding immer ?
- Adding TS enforcement anyway that developer will know when he mutate state and potentially creating bugs / make it as warning and not error
- Maybe investing more ways to use immutability in Onyx except immer which might have better performance
- Add immer as an optional - maybe via middleware
