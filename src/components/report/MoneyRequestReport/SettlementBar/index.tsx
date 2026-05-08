type SettlementBarProps = {
    /** Identity of the multi-transaction money-request report this bar acts on. */
    reportID: string | undefined;
};

/**
 * Settle / approve / pay action bar for `MoneyRequestReport`. Today the visible
 * action row lives inside `MoneyReportHeader` (which `MoneyRequestReport.Header`
 * mounts), so this block is intentionally empty — it claims the namespace slot for
 * a follow-up extraction without producing duplicated UI.
 *
 * The block is mounted by the compound shell so its placement in the tree is
 * stable across the upcoming extraction; render-counter spies on this block
 * confirm it does not re-render on receipt-target or selection changes.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- See block comment above.
function SettlementBar({reportID}: SettlementBarProps) {
    return null;
}

SettlementBar.displayName = 'MoneyRequestReport.SettlementBar';

export default SettlementBar;
