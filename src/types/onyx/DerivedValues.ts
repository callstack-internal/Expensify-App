import type {OnyxCollection} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import type CONST from '@src/CONST';
import type {Errors} from './OnyxCommon';
import type {ReportActions} from './ReportAction';

/**
 * The attributes of a report.
 */
type ReportAttributes = {
    /**
     * The name of the report.
     */
    reportName: string;
    /**
     * Whether the report is empty (has no visible messages).
     */
    isEmpty: boolean;
    /**
     * The status of the brick road.
     */
    brickRoadStatus: ValueOf<typeof CONST.BRICK_ROAD_INDICATOR_STATUS> | undefined;
    /**
     * Whether the report requires attention from current user.
     */
    requiresAttention: boolean;
    /**
     * The errors of the report.
     */
    reportErrors: Errors;
};

/**
 * The derived value for report attributes.
 */
type ReportAttributesDerivedValue = {
    /**
     * The report attributes.
     */
    reports: Record<string, ReportAttributes>;
    /**
     * The locale used to compute the report attributes.
     */
    locale: string | null;
};

/**
 * The derived value containing last and sorted report actions for each report.
 */
type ReportActionsMetadataDerivedValue = {
    /**
     * The most recent report action for each report.
     */
    lastReportActions: ReportActions;
    /**
     * Sorted arrays of report actions for each report.
     */
    allSortedReportActions: OnyxCollection<ReportActions>;
    /**
     * The most recent visible report action for each report.
     */
    lastVisibleReportActions: ReportActions;
};

export default ReportAttributesDerivedValue;
export type {ReportAttributes, ReportActionsMetadataDerivedValue};
