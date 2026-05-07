type PaginationHandlerProps = {
    /** Identity of the report whose pagination triggers this block owns. */
    reportID: string | undefined;
};

/**
 * Renderless block placeholder for the scroll-driven pagination triggers described in
 * the PRD. The actual pagination plumbing today still lives inside the wrapped
 * `ReportActionsList` / `MoneyRequestReportActionsList` and is therefore covered by the
 * compound's `Actions` / `Table` block. This file marks the slot so that future slices
 * can move pagination triggers here without renaming.
 */
// Slot placeholder. The prop is documented for forward-compatibility (issue 02 will
// move scroll-driven pagination triggers here) but is not consumed today.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- See block comment above.
function PaginationHandler({reportID}: PaginationHandlerProps) {
    return null;
}

PaginationHandler.displayName = 'PaginationHandler';

export default PaginationHandler;
