/**
 * Format an already-resolved merged-transaction amount for display.
 *
 * Merge confirmation stores the user-chosen `amount` directly (see
 * `buildMergedTransactionData`), bypassing the sign-flip that
 * `getTransactionAmount` applies for expense reports vs IOUs. The merged
 * amount must be rendered as-is — `convertToDisplayString` handles only the
 * unit conversion, never the sign.
 *
 * Pure: no React, no Onyx. Unit-testable in isolation.
 */
type ConvertToDisplayString = (amount: number | undefined, currency: string | undefined) => string;

function formatMergeAmount(amount: number | undefined, currency: string | undefined, convertToDisplayString: ConvertToDisplayString): string {
    if (amount === undefined || amount === null) {
        return '';
    }
    return convertToDisplayString(amount, currency)?.toString() ?? '';
}

export default formatMergeAmount;
