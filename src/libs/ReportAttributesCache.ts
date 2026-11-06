/**
 * One module-level cache of the report attributes map, computed on demand from the Onyx state that the
 * `useOnyxState` hooks hand in. useOnyxState caches per hook instance, so without this every consumer would
 * recompute the whole map. The first consumer that renders after a write diffs the dependencies against the
 * ones behind the cached map, recomputes only the reports that change touched, and every other consumer of the
 * same state gets the cached map back.
 *
 * The map is saved to Onyx on idle, and the first compute after an app start begins from that snapshot instead
 * of computing every report, the way the derived value used to begin from its stored value.
 */

import IntlStore from '@src/languages/IntlStore';
import type {OnyxKey} from '@src/ONYXKEYS';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, ReportAttributesDerivedValue, ReportAttributesSnapshot} from '@src/types/onyx';
import {isEmptyObject} from '@src/types/utils/EmptyObject';

import type {OnyxCollection, OnyxEntry, UseOnyxStateSelector} from 'react-native-onyx';

import debounce from 'lodash/debounce';
import {AppState} from 'react-native';
import OnyxKeys from 'react-native-onyx/dist/OnyxKeys';

import type {ReportAttributesComputeContext, ReportAttributesDependencyValues} from './computeReportAttributes';

import saveReportAttributesSnapshot from './actions/ReportAttributesSnapshot';
import createReportAttributesComputer, {REPORT_ATTRIBUTES_DEPENDENCIES} from './computeReportAttributes';
import getCollectionDelta from './getCollectionDelta';
import Log from './Log';

// Translations load asynchronously after a locale change, and names must not be computed in the new locale
// before its strings are there, so the locale is taken from IntlStore only once loading has finished. The snapshot
// is read only by the first compute after an app start.
const REPORT_ATTRIBUTES_STATE_DEPENDENCIES = [...REPORT_ATTRIBUTES_DEPENDENCIES, ONYXKEYS.RAM_ONLY_ARE_TRANSLATIONS_LOADING, ONYXKEYS.SESSION, ONYXKEYS.REPORT_ATTRIBUTES_SNAPSHOT] as const;

// Saving rewrites the whole map, so it waits for a quiet moment instead of following every change.
const SNAPSHOT_SAVE_DELAY_MS = 5000;
const SNAPSHOT_SAVE_MAX_WAIT_MS = 30000;

type ReportAttributesStateView = Parameters<UseOnyxStateSelector<unknown, typeof REPORT_ATTRIBUTES_STATE_DEPENDENCIES>>[0];

const PREFERRED_LOCALE_INDEX = REPORT_ATTRIBUTES_DEPENDENCIES.indexOf(ONYXKEYS.NVP_PREFERRED_LOCALE);

const EMPTY_REPORT_ATTRIBUTES: ReportAttributesDerivedValue = {reports: {}, locale: null};

let computeReportAttributes = createReportAttributesComputer();
let cachedDependencyValues: ReportAttributesDependencyValues | undefined;
let cachedValue: ReportAttributesDerivedValue | undefined;
let loadedLocale: ReturnType<typeof IntlStore.getCurrentLocale>;

let snapshotAccountID: number | undefined;

const saveSnapshot = debounce(
    () => {
        if (!cachedValue || snapshotAccountID === undefined) {
            return;
        }
        saveReportAttributesSnapshot({...cachedValue, accountID: snapshotAccountID});
    },
    SNAPSHOT_SAVE_DELAY_MS,
    {maxWait: SNAPSHOT_SAVE_MAX_WAIT_MS},
);

/** Runs a pending snapshot save right away instead of waiting for a quiet moment. */
function flushReportAttributesSnapshot() {
    saveSnapshot.flush();
}

// The app can be killed once it is in the background, so a pending save runs before that.
AppState.addEventListener('change', (state) => {
    if (state !== 'background') {
        return;
    }
    flushReportAttributesSnapshot();
});

function resetReportAttributesCache() {
    saveSnapshot.cancel();
    computeReportAttributes = createReportAttributesComputer();
    cachedDependencyValues = undefined;
    cachedValue = undefined;
}

/**
 * Starts from the saved snapshot when it was computed for this account and locale. Reports added or removed since
 * it was saved are handed to the compute as changed, so only they are computed.
 */
function buildSnapshotContext(snapshot: OnyxEntry<ReportAttributesSnapshot>, reports: OnyxCollection<Report>, accountID: number | undefined): ReportAttributesComputeContext | undefined {
    if (!snapshot || !reports || snapshot.accountID !== accountID || snapshot.locale !== loadedLocale) {
        return undefined;
    }
    const changedReports: Record<string, Report | undefined> = {};
    let hasChangedReports = false;
    for (const key of Object.keys(reports)) {
        if (!snapshot.reports[key.slice(ONYXKEYS.COLLECTION.REPORT.length)]) {
            changedReports[key] = reports[key];
            hasChangedReports = true;
        }
    }
    for (const reportID of Object.keys(snapshot.reports)) {
        const key = `${ONYXKEYS.COLLECTION.REPORT}${reportID}`;
        if (!(key in reports)) {
            changedReports[key] = undefined;
            hasChangedReports = true;
        }
    }
    return {
        currentValue: {reports: snapshot.reports, locale: snapshot.locale},
        sourceValues: hasChangedReports ? {[ONYXKEYS.COLLECTION.REPORT]: changedReports} : undefined,
        triggeredKeys: new Set<OnyxKey>([ONYXKEYS.COLLECTION.REPORT]),
    };
}

function readDependencyValues(state: ReportAttributesStateView): ReportAttributesDependencyValues {
    // A tuple can't be built by mapping over the keys and keep its per-index types.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const values = REPORT_ATTRIBUTES_DEPENDENCIES.map((key) => state[key]) as unknown as ReportAttributesDependencyValues;
    values[PREFERRED_LOCALE_INDEX] = loadedLocale;
    return values;
}

function areDependencyValuesUnchanged(values: ReportAttributesDependencyValues, previousValues: ReportAttributesDependencyValues | undefined): boolean {
    if (!previousValues) {
        return false;
    }
    for (let index = 0; index < values.length; index++) {
        if (values[index] !== previousValues[index]) {
            return false;
        }
    }
    return true;
}

/** Builds the same delta the OnyxDerived engine hands a config: the changed members of each collection, and every changed key. */
function buildComputeContext(values: ReportAttributesDependencyValues, previousValues: ReportAttributesDependencyValues): ReportAttributesComputeContext {
    const triggeredKeys = new Set<OnyxKey>();
    const sourceValues: Record<string, unknown> = {};
    let hasSourceValues = false;
    for (let index = 0; index < REPORT_ATTRIBUTES_DEPENDENCIES.length; index++) {
        if (values[index] === previousValues[index]) {
            continue;
        }
        const key = REPORT_ATTRIBUTES_DEPENDENCIES[index];
        triggeredKeys.add(key);
        if (OnyxKeys.isCollectionKey(key)) {
            // A collection dependency holds a collection at every collection index.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            const delta = getCollectionDelta(values[index] as OnyxCollection<unknown>, previousValues[index] as OnyxCollection<unknown>);
            if (delta !== undefined) {
                sourceValues[key] = delta;
                hasSourceValues = true;
            }
        } else if (values[index] !== undefined) {
            sourceValues[key] = values[index];
            hasSourceValues = true;
        }
    }
    return {
        currentValue: cachedValue,
        sourceValues: hasSourceValues ? sourceValues : undefined,
        triggeredKeys,
    };
}

/**
 * Returns the report attributes for the given Onyx state, computing only what changed since the last call.
 * Returns the same reference while none of the dependencies changed.
 */
function getReportAttributes(state: ReportAttributesStateView): ReportAttributesDerivedValue {
    // The flag is undefined after Onyx.clear until the next locale change, and the loaded translations stay usable then.
    if (state[ONYXKEYS.RAM_ONLY_ARE_TRANSLATIONS_LOADING] !== true) {
        loadedLocale = IntlStore.getCurrentLocale() ?? loadedLocale;
    }

    const reports = state[ONYXKEYS.COLLECTION.REPORT];
    // No reports means Onyx was cleared (sign out) or has not loaded yet, so the next compute must start from scratch.
    if (!reports || isEmptyObject(reports)) {
        resetReportAttributesCache();
        return EMPTY_REPORT_ATTRIBUTES;
    }

    // The names depend on the loaded translations, so wait for them instead of computing every name twice.
    if (!loadedLocale) {
        return cachedValue ?? EMPTY_REPORT_ATTRIBUTES;
    }

    const values = readDependencyValues(state);
    if (cachedValue && areDependencyValuesUnchanged(values, cachedDependencyValues)) {
        return cachedValue;
    }

    const accountID = state[ONYXKEYS.SESSION]?.accountID;
    const context: ReportAttributesComputeContext = cachedDependencyValues
        ? buildComputeContext(values, cachedDependencyValues)
        : (buildSnapshotContext(state[ONYXKEYS.REPORT_ATTRIBUTES_SNAPSHOT], reports, accountID) ?? {
              currentValue: undefined,
              sourceValues: undefined,
              triggeredKeys: new Set<OnyxKey>(REPORT_ATTRIBUTES_DEPENDENCIES),
          });

    try {
        const previousValue = cachedValue;
        cachedValue = computeReportAttributes(values, context);
        cachedDependencyValues = values;
        snapshotAccountID = accountID;
        if (cachedValue !== previousValue) {
            saveSnapshot();
        }
    } catch (error) {
        // Keep the old baselines, so the next change re-diffs everything since the last good compute.
        Log.alert('[ReportAttributesCache] compute threw, keeping the previous report attributes', {error});
    }
    return cachedValue ?? EMPTY_REPORT_ATTRIBUTES;
}

export {flushReportAttributesSnapshot, getReportAttributes, resetReportAttributesCache, REPORT_ATTRIBUTES_STATE_DEPENDENCIES};
export type {ReportAttributesStateView};
