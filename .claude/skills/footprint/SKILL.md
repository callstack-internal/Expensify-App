---
name: footprint
description: Measure the runtime footprint of a user flow — Onyx subscription activity and React commits — on iOS or Android, and compare it against a committed baseline. Use when checking whether a change makes a screen re-render or re-subscribe more than it used to, when investigating why a screen feels slow, or when a pull request needs a runtime performance check.
---

# Runtime footprint harness

Counts what a flow costs at runtime and compares it against a baseline. Two signals, kept separate:

| Signal | What it is | Where it comes from |
| --- | --- | --- |
| Onyx subscription activity | How often subscribers were woken, how many were live, and how many watch a whole collection | `src/libs/OnyxSubscriptionProbe.ts`, via Rozenite in-app agent tools |
| React commit activity | Commits a component appeared in, with `changedKeys` naming what triggered each | Rozenite `react` domain (`getComponentRenders`) |

## Reading the Onyx table

Every row is one Onyx **key group**: collection members fold into their prefix, so `report_1` and
`report_9` both count under `report_`.

| Column | JSON field | Meaning |
| --- | --- | --- |
| `updates` | `notifies` | How many times a subscriber's callback fired because a watched key changed |
| `live peak` | `peakConcurrent` | The most subscribers alive at the same instant |
| `subscribers` | `subscribes` | How many subscriptions were created during the run (cumulative, not simultaneous) |
| `whole-collection` | `rootSubscribes` | How many of those watch the entire collection rather than one member. `·` means none |

Worked example — `policy_  141  57  57  36` from one Home→Spend tab switch: 57 subscriptions
created, all 57 still alive at the end (`live peak` equal to `subscribers` means nothing
unsubscribed), 36 of them watching the whole `policy_` collection, 141 callbacks fired.

`whole-collection` is the expensive column. A member subscriber wakes only when that member
changes; a whole-collection subscriber wakes for every member, which is why a new one is a hard
flag rather than a threshold.

`updates` is an **upper bound** on re-renders: `useOnyx` still runs its equality check and any
selector after the callback fires and may bail out. Do not read a notify count as a render count.

Every number comes from a **debug build**. It is comparative within one build mode only — never
quote an absolute figure as a user-facing metric.

## Prerequisites

1. Metro with Rozenite enabled: `WITH_ROZENITE=true npm start`
2. A debug build of the app, connected to that Metro. It does **not** need rebuilding for Rozenite:
   a debug build fetches its JS from Metro at launch, so the `WITH_ROZENITE` module resolution
   applies to an existing binary as soon as it reloads. Only a release build, with JS baked in,
   would need rebuilding.
3. `agent-device` on `PATH`, and **only one version of it**. Several may be installed, one per nvm
   node version (`ls ~/.nvm/versions/node/*/bin/agent-device`). A bare shell can pick an old one
   while this repo's node 26.5.0 has a newer one; mixing them makes the newer client replace the
   older daemon mid-run and the session dies with `No active session. Run open first.` Pin the PATH
   for the whole command:

   ```bash
   PATH="$HOME/.nvm/versions/node/v26.5.0/bin:$PATH" npm run footprint -- diagnose <flow> --platform android
   ```

   After a version clash, clear the stale daemon once with `agent-device daemon stop --clean`.
   Version **0.13.0 or newer** is required for any flow declaring `@param`.
4. A device, simulator or emulator with the app installed and signed in

Check all four before running anything:

```bash
npm run footprint -- doctor
```

`doctor` lists the connected targets, every Rozenite domain with its availability, and the in-app
tools. `react` must be present or the profiler half cannot run; `app` must be present or the Onyx
half comes back empty. It touches nothing, so it is the safe first move whenever a run looks wrong.

Do **not** probe `http://127.0.0.1:8081/rozenite/` to decide whether Rozenite is mounted — it
returns 404 even when Rozenite is working fine.

## Commands

Diagnose one run — the daily-use command. No baseline, no medians, just what happened. It measures
from wherever the app already is: no relaunch, no warmup, no reset, because relaunching is the most
fragile step on a physical device. Pass `--relaunch` to opt in; `capture` relaunches by default and
takes `--no-relaunch`.

```bash
npm run footprint -- diagnose create-expense-manual --platform android
```

Capture N runs and write medians:

```bash
npm run footprint -- capture create-expense-manual --platform android --runs 5
```

Write or refresh a baseline (commits under `footprint/baselines/<flow>.<platform>.json`):

```bash
npm run footprint -- capture create-expense-manual --platform android --runs 7 --baseline
```

Compare a candidate against its baseline:

```bash
npm run footprint -- compare footprint/baselines/create-expense-manual.android.json footprint/candidates/create-expense-manual.android.json
```

`capture` writes to `footprint/candidates/` by default, which is where CI looks; `--baseline` writes
to `footprint/baselines/` instead. `--out` overrides either.

Flags: `--platform ios|android`, `--runs N`, `--baseline`, `--out path`, `--app-id id`, `--device id`.

The app id is read from the connected target, so `--app-id` is only needed to override it. Do not
assume one per platform: HybridApp Android is `org.me.mobiexpensifyg.dev` while standalone NewDot
Android is `com.expensify.chat.dev`.

## Flows

Flows are the existing `.ad` files under `.claude/skills/agent-device/flows/tests/`, referenced by
bare name. `@param KEY` headers are filled from `AD_<KEY>` in the environment, the same convention
`measure-telemetry-span` uses. `@reset` is honored; without it the app is relaunched between runs so
run 2 starts where run 1 did.

Parameter-free flows, usable on any agent-device version: `open-create-expense`,
`open-search-router`, `scan-receipt-init`, `submit-expense`, `switch-home-to-reports`. The
parametrised ones (`create-expense-manual`, `open-report`, `send-message`) need 0.13.0+ and their
`AD_<KEY>` values.

Only use flows whose variance you have checked. `switch-home-to-inbox.ad` is known broken on the iOS
simulator (a nav-init race, not a code regression).

## Gate rules

All four are pure comparisons; no model decides whether a check fails.

| Rule | Condition | Verdict |
| --- | --- | --- |
| `render-count` | ratio > 1.5 **and** absolute delta > 5 | warn |
| `update-count` | ratio > 2.0 | warn |
| `peak-subscribers` | delta >= 1 | warn |
| `new-whole-collection-subscription` | a subscriber watches a whole collection where the baseline had none | flag |

The last rule is the one worth the harness. A flow newly subscribing to a collection *root* — as
opposed to one member — is notified for every member change, and is nearly always accidental. It
needs no threshold, so it has no false-positive class to tune.

`compare` exits non-zero on a flag, zero on warnings only.

## CI

`.github/workflows/footprintCheck.yml` runs on pull requests labelled `footprint`. It compares each
committed `footprint/candidates/*.json` against its baseline and posts the result with `gh pr comment`.
Capture is not run in CI — no runner here has a device — so a contributor captures locally and
commits the JSON.

The workflow is **warn-only**: it comments and annotates but never fails the job. Flip the final
block to `exit $flagged` once a week of runs has come back clean.

## When a replay fails

- **`press … left <app> and foregrounded com.sec.android.app.launcher`**: the tap escaped the app
  and hit system navigation. `switch-home-to-reports` does this on a physical Samsung, because
  `label="Home"` matches the hardware home button before the in-app tab. Nothing rendered, so the
  run reports zero components. Fix the flow's selector, do not widen the harness.
- **`find matched 2 elements`**: an ambiguous selector. `open-create-expense` and
  `scan-receipt-init` both open with `find "Inbox" "click"`, which matches twice on current builds.
  Flows using `press "label=…"` are safer.
- **Everything unmatched, including selectors you can see on screen**: a React Native LogBox overlay
  is covering the app. The harness runs `agent-device react-native dismiss-overlay` before every
  precondition check; if it persists, dismiss it by hand.


- **`Selector did not match` at step 1**: the flow's `@pre` did not hold. Flows in `flows/tests/`
  are fragments — `submit-expense` needs the confirmation page already open and can never run from
  a cold launch. The harness checks `@pre` first and names the unmet selector.
- **`Android snapshot helper returned insufficient foreground app content`**: the app is foreground
  but showing something UIAutomator cannot read, usually a bundle still loading. Bring the app to a
  settled screen by hand and re-run.
- **`No active session. Run open first.`**: two agent-device versions clashed, or `--state-dir` was
  missing. `replay` and `test` otherwise start an ephemeral daemon under the system temp directory
  that holds no session. The harness passes `--state-dir ~/.agent-device` on every call.
- **`SESSION_NOT_FOUND … iOS snapshot requires an active app session`**: a state query ran without
  `--platform`, so agent-device defaulted to iOS. Every query the harness makes is platform-scoped;
  if you reproduce by hand, pass `--platform android` and `--state-dir` yourself.

## When a run comes back empty

- **No Onyx activity**: the `app` domain is not registered. Run `doctor` to confirm, then reload the
  JS bundle on the device — registration is mount-scoped, so every app relaunch drops it.
- **No render data**: the profiler attached to the wrong target. `react-native-worklets` and
  Reanimated each add a debuggable runtime, so several targets per device is normal — re-run with
  `--device <deviceId>` for the row whose `app=` matches the app under test.
- **Both empty**: Metro is running without Rozenite. Check for the Rozenite banner on startup.
