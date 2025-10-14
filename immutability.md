**How other state libraries using Immutability**

Below table which demonstrate state libraries and how it treat immutability :


<img width="1170" height="625" alt="Screenshot 2025-10-08 at 11 27 28" src="https://github.com/user-attachments/assets/35b35f04-51aa-4f8b-ae9d-b7b62b1e9424" />

<img width="826" height="241" alt="Screenshot 2025-10-08 at 11 31 28" src="https://github.com/user-attachments/assets/33e0f0cb-6e61-4aa1-8ebf-c141b2f1c565" />


Most state libraries **don't enforce** immutability, but letting the developer decide on it sometimes with the help of middlewares which can enforce it (e.g Redux or Zustand).  

**Adding immutability in Onyx**

We will show how to add immutability in 2 ways:

Using [immer.js](http://immer.js) and using Typescript

- Implementing [immer.js](http://immer.js) in Onyx:

On [this branch](https://github.com/callstack-internal/react-native-onyx/tree/eliran/immutability-immer) there is a sample of a way to implement [immer.js](http://immer.js) in Onyx codebase.

**Performance comparison:**

When adding it in _fastMerge_ there's significantly worse performance over the current implementation.

I ran it in our _perf-test_ and this is the results taken from _current.perf_ after running the tests:  
<br/>{"name":"utils fastMerge one call with current implementation","type":"function","runs":10,"meanDuration":**2.7215091111089955**,"stdevDuration":0.05189331658530679,"durations":\[2.805958000011742,2.73741699999664,2.6552080000110436,2.737833999999566,2.7754579999891575,2.6538329999893904,2.739332999990438,2.6841659999918193,2.704375000001164\],"warmupDurations":\[2.8848330000037095\],"outlierDurations":\[4.22516600000381\],"meanCount":1,"stdevCount":0,"counts":\[1,1,1,1,1,1,1,1,1,1\]}

{"name":"utils fastMerge one call with Immer implementation","type":"function","runs":10,"meanDuration":**30.018466600001556**,"stdevDuration":0.5998225312078885,"durations":\[29.786833999998635,30.700333000000683,29.732499999998254,30.31533300000592,29.043583000006038,30.464042000006884,29.8559580000001,30.675583000003826,29.15274999999383,30.457750000001397\],"warmupDurations":\[56.20929199999955\],"outlierDurations":\[\],"meanCount":1,"stdevCount":0,"counts":\[1,1,1,1,1,1,1,1,1,1\]

Difference is around **12x** slower when using _fastMerge_ with immerjs.

Yet this is a test of a very big array , of adding 1000 items to an array of 500 items.

Based on this there is few possibility to consider

- Use it by default and get much worse performance for better state handling and potentially less bugs due to mutability.
- Not using it and letting the developer decide .
- Make it optional (e.g adding a flag) to _fastMerge_ so the developer can use it if he wants.

<br/>2\. Adding typescript enforcement that onyx will return only _readOnly_ values

I implemented this in the 0nyx codebase in [this branch](https://github.com/callstack-internal/react-native-onyx/tree/eliran/typescript-readonly) in Onyx.

To test the implementation on E/App you can use [this branch](https://github.com/callstack-internal/Expensify-App/tree/eliran/typesceipt-readonly-onyx) in E/App

When using it in E/App there's 2177 ts errors in 495 files.

Further investigations ideas:

- Is it worth it to try and fix some of those errors in readonly and this way enforce immutability without affecting performance e.g adding immer ?
- Adding ts enforcement anyway that developer will know when he mutate state and potentially creating bugs / make it as warning and not error
- Maybe investing more ways to use immutability in Onyx except immer which might have better performance
- Add immer as an optional - maybe via middleware
