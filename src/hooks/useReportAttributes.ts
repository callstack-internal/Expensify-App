import {getReportAttributes, REPORT_ATTRIBUTES_STATE_DEPENDENCIES} from '@libs/ReportAttributesCache';

import type {ReportAttributesDerivedValue} from '@src/types/onyx';

import reportNamesByIDsSelector from '@selectors/ReportAttributes';
import {useOnyxState} from 'react-native-onyx';

const isSameReference = <T>(a: T, b: T) => a === b;

/**
 * Returns the attributes of every report, computed from the live Onyx state. The map keeps its reference until a
 * change touches one of its reports, so it is compared by reference: a deep compare would walk every report.
 */
function useAllReportAttributes(): ReportAttributesDerivedValue['reports'] {
    return useOnyxState((state) => getReportAttributes(state).reports, {
        dependencies: REPORT_ATTRIBUTES_STATE_DEPENDENCIES,
        selectorEquality: isSameReference,
    });
}

/**
 * Returns what `selector` picks from the report attributes. The output is compared deeply, so keep it small: the
 * component re-renders only when it changes.
 */
function useReportAttributesSelector<TOutput>(selector: (attributes: ReportAttributesDerivedValue) => TOutput): TOutput {
    return useOnyxState((state) => selector(getReportAttributes(state)), {dependencies: REPORT_ATTRIBUTES_STATE_DEPENDENCIES});
}

/** Returns one report's attributes. The component re-renders only when that report's attributes change. */
function useReportAttributesEntry(reportID: string | undefined) {
    return useOnyxState((state) => (reportID ? getReportAttributes(state).reports[reportID] : undefined), {
        dependencies: REPORT_ATTRIBUTES_STATE_DEPENDENCIES,
    });
}

/** Returns the action badge and RBR/GBR status of one report, re-rendering only when one of them changes. */
function useReportStatus(reportID: string | undefined) {
    return useOnyxState(
        (state) => {
            const attributes = reportID ? getReportAttributes(state).reports[reportID] : undefined;
            if (!attributes) {
                return undefined;
            }
            return {
                actionBadge: attributes.actionBadge,
                actionTargetReportActionID: attributes.actionTargetReportActionID,
                brickRoadStatus: attributes.brickRoadStatus,
            };
        },
        {dependencies: REPORT_ATTRIBUTES_STATE_DEPENDENCIES},
    );
}

/** Returns one report's name. The component re-renders only when that name changes. */
function useReportName(reportID: string | undefined) {
    return useOnyxState((state) => (reportID ? getReportAttributes(state).reports[reportID]?.reportName : undefined), {
        dependencies: REPORT_ATTRIBUTES_STATE_DEPENDENCIES,
    });
}

/** Returns a `{reportID: reportName}` map for the given reportIDs, re-rendering only when one of those names changes. */
function useReportNames(reportIDs: Array<string | undefined>) {
    return useOnyxState(
        (state) => {
            const {reports} = getReportAttributes(state);
            const reportNames: Record<string, string | undefined> = {};
            for (const reportID of reportIDs) {
                if (reportID) {
                    reportNames[reportID] = reports[reportID]?.reportName;
                }
            }
            return reportNames;
        },
        {dependencies: REPORT_ATTRIBUTES_STATE_DEPENDENCIES},
    );
}

/**
 * Returns `{reportID: {reportName}}` for the given reportIDs, the shape the LHN option builders take, re-rendering
 * only when one of those names changes.
 */
function useReportNameEntries(reportIDs: Array<string | undefined>) {
    return useOnyxState((state) => reportNamesByIDsSelector(getReportAttributes(state), reportIDs), {dependencies: REPORT_ATTRIBUTES_STATE_DEPENDENCIES});
}

/** Returns one report's `isEmpty` flag. The component re-renders only when it changes. */
function useIsEmptyReport(reportID: string | undefined) {
    return useOnyxState((state) => (reportID ? getReportAttributes(state).reports[reportID]?.isEmpty : undefined), {
        dependencies: REPORT_ATTRIBUTES_STATE_DEPENDENCIES,
    });
}

export {useAllReportAttributes, useReportAttributesSelector, useReportAttributesEntry, useReportStatus, useReportName, useReportNames, useReportNameEntries, useIsEmptyReport};
