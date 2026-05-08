import React from 'react';
import ReportActionsList from '@pages/inbox/ReportActionsList';

type ActionsProps = {
    /** Identity of the transaction-thread or top-level single-tx report being rendered. */
    reportID: string | undefined;

    /**
     * Optional linked-action id forwarded by the dispatcher. Used by `ReportActionsList`
     * (and the orchestrator below it) to scroll the linked action into view and
     * highlight it on deep-link arrivals like `r/:reportID?reportActionID=:actionID`.
     */
    reportActionID?: string;
};

/**
 * Thin wrapper around today's screen-level `ReportActionsList` orchestrator.
 *
 * Today the orchestrator sources both `reportID` and `reportActionID` from
 * `useRoute()` itself, so the props on this block are unused at runtime. They
 * appear in the prop type so this block commits to the no-`useRoute` contract for
 * compound blocks today, and so a follow-up that makes the orchestrator accept
 * its ids as props will flow them straight through without renaming any imports.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- See block comment above.
function Actions({reportID, reportActionID}: ActionsProps) {
    return <ReportActionsList />;
}

Actions.displayName = 'TransactionThread.Actions';

export default Actions;
