# Measurement harness for expensify-issues#3042 (not for merge)

Used to measure whether path-level subscription tracking in Onyx is worth it, and to A/B the App-side report-write fixes.

## Pieces
- **Onyx:** branch `eliran/3042-path-skip-prototype` in `callstack-internal/react-native-onyx` (based on 3.0.117). Build it with `npm run build` and copy `dist/` into this App's `node_modules/react-native-onyx/dist/`, then clear the build cache with `rm -rf node_modules/.cache/rspack`.
- **`onyxSelectorStatsFlag.js`** (imported first in `index.js`):
  - Web: turns on write timing. `localStorage.onyxSelectorStats = '1'` adds the full Proxy-based selector counters. `localStorage.onyxPathProto = 'off' | 'static' | 'auto'` picks the path-skip prototype mode.
  - Native: a benchmark that waits for the heavy test account to load, then runs 10 updates each to `report_`, `personalDetailsList` and `reportActions_` in every prototype mode. It logs `BENCH3042 ...` with `console.warn`, because production builds strip `console.log`.
- **`config/rsbuild/rsbuild.config.ts`:** `PERF_PROD=1 node ./node_modules/.bin/rsbuild dev --mode production --config config/rsbuild/rsbuild.config.ts` serves a production React bundle from the dev server, so the same origin and login keep working.

## Web scripts (Playwright `browser_run_code`)
- `profile3042.js`: 10 field-only updates × 3 rounds on the open chat, 4× CPU, CPU profile split into areas (unread memo, LHN context, OnyxDerived, Onyx dispatch, React render).
- `soak3042.js`: 200 updates (10 chunks of 20) to see whether per-update cost grows over a session.
- `proto3042.js`: path-skip prototype A/B across `off` / `static` / `auto` for three keys.

Each script checks the signed-in account before measuring. Sessions are per origin (port), so sign in, or switch to the copilot account, in the tab you measure in.

## Android (release-style build)
`cd Mobile-Expensify/Android && PATH="$PWD/../../node_modules/.bin:$PATH" IS_HYBRID_APP=true SENTRY_DISABLE_AUTO_UPLOAD=true ./gradlew assembleAdhoc -PreactNativeArchitectures=arm64-v8a`

Local-only setup that isn't committed:
- In `Mobile-Expensify/Android/build.gradle`, sign the `adhoc` build type with `signingConfigs.debug`.
- Copy `.env.hybridapp.android` to `.env.adhoc.hybridapp.android`.

`bun` must be on `PATH`, otherwise the prebuilt React Native artifacts lookup fails. If the emulator is short on space, uninstall the old build first.
