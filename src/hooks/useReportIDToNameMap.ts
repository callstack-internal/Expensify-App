import ONYXKEYS from '@src/ONYXKEYS';
import type {Report} from '@src/types/onyx';

import type {OnyxCollection} from 'react-native-onyx';

import {useOnyxState} from 'react-native-onyx';

/** Mapping from reportID to report name. */
type ReportIDToNameMap = Record<string, string>;

/** Narrows a reportID -> name map to the rooms whose #name appears in the given markdown, e.g. a draft that will be compared against HTML holding <mention-report reportID=...> */
function getReportIDToNameMapForRoomsInMarkdown(reportIDToName: ReportIDToNameMap | undefined, markdown: string): ReportIDToNameMap | undefined {
    if (!reportIDToName || !markdown.includes('#')) {
        return undefined;
    }
    const map: ReportIDToNameMap = {};
    for (const [reportID, reportName] of Object.entries(reportIDToName)) {
        // Only rooms can be mentioned in markdown, and their names keep the leading #.
        if (reportName.startsWith('#') && markdown.includes(reportName)) {
            map[reportID] = reportName;
        }
    }
    return map;
}

function getMappedName(report: Report): string {
    return report.reportName ?? report.reportID;
}

/** Builds a map of reportID to report name from COLLECTION.REPORT. */
function buildReportIDToNameMap(reports: OnyxCollection<Report> | undefined): ReportIDToNameMap {
    const map: ReportIDToNameMap = {};
    for (const report of Object.values(reports ?? {})) {
        if (!report) {
            continue;
        }
        map[report.reportID] = getMappedName(report);
    }
    return map;
}

function hasReportIDToNameChanged(previousReports: OnyxCollection<Report>, reports: OnyxCollection<Report>): boolean {
    for (const [key, report] of Object.entries(reports ?? {})) {
        const previousReport = previousReports?.[key];
        if (report === previousReport) {
            continue;
        }
        if (report?.reportID !== previousReport?.reportID || (report && getMappedName(report)) !== (previousReport && getMappedName(previousReport))) {
            return true;
        }
    }
    for (const [key, previousReport] of Object.entries(previousReports ?? {})) {
        if (previousReport && !reports?.[key]) {
            return true;
        }
    }
    return false;
}

// Shared by every mounted consumer: collection snapshots keep unchanged members reference-equal, so most writes
// (a new message, a read marker) are detected as name-neutral with reference checks and reuse the previous map.
let cachedReports: OnyxCollection<Report> | undefined;
let cachedReportIDToName: ReportIDToNameMap = {};

function selectReportIDToNameMap(reports: OnyxCollection<Report> | undefined): ReportIDToNameMap {
    if (reports === cachedReports) {
        return cachedReportIDToName;
    }
    const previousReports = cachedReports;
    cachedReports = reports;
    if (!previousReports || hasReportIDToNameChanged(previousReports, reports)) {
        cachedReportIDToName = buildReportIDToNameMap(reports);
    }
    return cachedReportIDToName;
}

/** Returns a map of reportID to report name built from COLLECTION.REPORT, re-rendering only when a name changes. */
function useReportIDToNameMap(): ReportIDToNameMap {
    return useOnyxState((state) => selectReportIDToNameMap(state[ONYXKEYS.COLLECTION.REPORT]), {
        dependencies: [ONYXKEYS.COLLECTION.REPORT],
        selectorEquality: (a, b) => a === b,
    });
}

export default useReportIDToNameMap;
export {buildReportIDToNameMap, getReportIDToNameMapForRoomsInMarkdown};
