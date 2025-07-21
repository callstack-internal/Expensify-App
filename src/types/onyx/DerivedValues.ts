import type {ValueOf} from 'type-fest';
import type CONST from '@src/CONST';
import type {Errors} from './OnyxCommon';
import type {ReportActions} from './ReportAction';
import type ReportAction from './ReportAction';
import type Transaction from './Transaction';
import type TransactionViolations from './TransactionViolation';

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
 * The transactions and violations of a report.
 */
type ReportTransactionsAndViolations = {
    /**
     * The transactions of the report.
     */
    transactions: Record<string, Transaction>;
    /**
     * The violations of the report.
     */
    violations: Record<string, TransactionViolations>;
};

/**
 * The metadata for a single report's actions.
 */
type ReportActionsMetadata = {
    /**
     * The most recent report action for the report.
     */
    lastReportAction?: ReportActions;
    /**
     * Sorted array of report actions for the report.
     */
    allSortedReportActions?: ReportActions[];
    /**
     * The most recent visible report action for the report.
     */
    lastVisibleReportAction?: ReportAction;
    /**
     * The most recent visible report action suitable for display as the last action in sidebar/LHN.
     * This is similar to lastVisibleReportAction but uses more restrictive filtering.
     */
    lastVisibleReportActionForDisplay?: ReportAction;
};

/**
 * The derived value for report transactions.
 */
type ReportTransactionsAndViolationsDerivedValue = Record<string, ReportTransactionsAndViolations>;

/**
 * The derived value for report actions metadata.
 */
type ReportActionsMetadataDerivedValue = Record<string, ReportActionsMetadata>;

export default ReportAttributesDerivedValue;
export type {ReportAttributes, ReportAttributesDerivedValue, ReportTransactionsAndViolationsDerivedValue, ReportTransactionsAndViolations, ReportActionsMetadataDerivedValue};
