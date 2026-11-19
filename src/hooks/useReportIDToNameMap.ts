import ONYXKEYS from '@src/ONYXKEYS';
import type {Report} from '@src/types/onyx';

import type {OnyxCollection} from 'react-native-onyx';

import useOnyxState from './useOnyxState';

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

// Same reportID capture and flags as ExpensiMark's reportMentions rule, which accepts the ID with or without quotes and in any case
const MENTION_REPORT_ID_REGEX = /<mention-report reportID="?(\d+)"?/gi;

// Any non-empty room name works as a placeholder, because every room name starts with #
const MENTIONED_ROOM_PLACEHOLDER = '#room';

/** Returns the unique reportIDs of the `<mention-report reportID="...">` tags in the given HTML. */
function getMentionedReportIDs(html: string | undefined): string[] {
    if (!html || !/<mention-report reportID/i.test(html)) {
        return [];
    }
    return [...new Set(Array.from(html.matchAll(MENTION_REPORT_ID_REGEX), (match) => match[1]))];
}

/**
 * Maps every room the HTML mentions by reportID to a placeholder name. Use it only when the converted text is never shown,
 * so the conversion doesn't need a subscription to the reports and doesn't log a missing report name for each mention.
 */
function buildMentionedRoomPlaceholderMap(html: string | undefined): ReportIDToNameMap {
    return Object.fromEntries(getMentionedReportIDs(html).map((reportID) => [reportID, MENTIONED_ROOM_PLACEHOLDER]));
}

/**
 * Builds a map of reportID to report name from COLLECTION.REPORT.
 * The map is keyed by the reportID taken from the Onyx key, not report.reportID, because a partial update can cache a report without its reportID.
 *
 * @param reportIDs - when passed, only these reports are looked up, so callers that know which rooms their HTML mentions avoid a pass over every report
 */
function buildReportIDToNameMap(reports: OnyxCollection<Report> | undefined, reportIDs?: string[]): ReportIDToNameMap {
    const map: ReportIDToNameMap = {};
    if (reportIDs) {
        for (const reportID of reportIDs) {
            const report = reports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
            if (report) {
                map[reportID] = report.reportName ?? reportID;
            }
        }
        return map;
    }
    for (const [key, report] of Object.entries(reports ?? {})) {
        if (!report) {
            continue;
        }
        const reportID = key.slice(ONYXKEYS.COLLECTION.REPORT.length);
        map[reportID] = report.reportName ?? reportID;
    }
    return map;
}

/** True when a report was added or removed, or a report name differs between the two collections. */
function hasReportNameChanged(previousReports: NonNullable<OnyxCollection<Report>>, reports: NonNullable<OnyxCollection<Report>>): boolean {
    for (const [key, report] of Object.entries(reports)) {
        const previousReport = previousReports[key];
        if (report === previousReport) {
            continue;
        }
        if (!report !== !previousReport || report?.reportName !== previousReport?.reportName) {
            return true;
        }
    }
    for (const [key, previousReport] of Object.entries(previousReports)) {
        if (previousReport && !reports[key]) {
            return true;
        }
    }
    return false;
}

const EMPTY_REPORT_ID_TO_NAME_MAP: ReportIDToNameMap = {};

// Keyed by the collection, not held as one last value, because the same selector runs with live reports in most places and
// with the reports of a Search snapshot inside Search. A single slot would be evicted on every switch between the two.
const reportIDToNameMapByReports = new WeakMap<NonNullable<OnyxCollection<Report>>, ReportIDToNameMap>();

/**
 * Returns the map for a report collection, shared by every consumer that reads the same collection. Most report writes
 * (a new message, a read marker) change no name, so the map of the previous collection is reused and consumers do not re-render.
 */
function selectReportIDToNameMap(reports: OnyxCollection<Report> | undefined, previousReports: OnyxCollection<Report> | undefined): ReportIDToNameMap {
    if (!reports) {
        return EMPTY_REPORT_ID_TO_NAME_MAP;
    }
    const cachedMap = reportIDToNameMapByReports.get(reports);
    if (cachedMap) {
        return cachedMap;
    }

    const previousMap = previousReports && reportIDToNameMapByReports.get(previousReports);
    const map = previousReports && previousMap && !hasReportNameChanged(previousReports, reports) ? previousMap : buildReportIDToNameMap(reports);
    reportIDToNameMapByReports.set(reports, map);
    return map;
}

function isSameReportIDToNameMap(map: ReportIDToNameMap, otherMap: ReportIDToNameMap): boolean {
    return map === otherMap;
}

/** Returns a map of reportID to report name built from COLLECTION.REPORT. The map keeps its reference until a report is added or removed, or a name changes. */
function useReportIDToNameMap(): ReportIDToNameMap {
    return useOnyxState((state, previousState) => selectReportIDToNameMap(state[ONYXKEYS.COLLECTION.REPORT], previousState?.[ONYXKEYS.COLLECTION.REPORT]), {
        selectorEquality: isSameReportIDToNameMap,
    });
}

export default useReportIDToNameMap;
export {buildMentionedRoomPlaceholderMap, buildReportIDToNameMap, getMentionedReportIDs, getReportIDToNameMapForRoomsInMarkdown};
