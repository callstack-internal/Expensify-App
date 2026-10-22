import type {GetReportTableColumnStylesParams} from '@styles/utils';

type ColumnSizeFlags = {
    isActionColumnWide: boolean;
    shouldShowYearCreated: boolean;
    shouldShowYearSubmitted: boolean;
    shouldShowYearApproved: boolean;
    shouldShowYearPosted: boolean;
    shouldShowYearExported: boolean;
    shouldShowYearWithdrawn: boolean;
    shouldShowAmountInWideColumn: boolean;
    shouldShowTaxAmountInWideColumn: boolean;
};

/** Compiled so the result keeps its identity while the flags don't change: it feeds the column widths context every row reads. */
function useSearchColumnSizeOptions({
    isActionColumnWide,
    shouldShowYearCreated,
    shouldShowYearSubmitted,
    shouldShowYearApproved,
    shouldShowYearPosted,
    shouldShowYearExported,
    shouldShowYearWithdrawn,
    shouldShowAmountInWideColumn,
    shouldShowTaxAmountInWideColumn,
}: ColumnSizeFlags): GetReportTableColumnStylesParams {
    return {
        isActionColumnWide,
        isDateColumnWide: shouldShowYearCreated,
        isSubmittedColumnWide: shouldShowYearSubmitted,
        isApprovedColumnWide: shouldShowYearApproved,
        isPostedColumnWide: shouldShowYearPosted,
        isExportedColumnWide: shouldShowYearExported,
        isWithdrawnColumnWide: shouldShowYearWithdrawn,
        isAmountColumnWide: shouldShowAmountInWideColumn,
        isTaxAmountColumnWide: shouldShowTaxAmountInWideColumn,
    };
}

export default useSearchColumnSizeOptions;
