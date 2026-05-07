import React from 'react';
import ReportActionsList from '@pages/inbox/ReportActionsList';

type ActionsProps = {
    /** Identity of the task report whose actions list this block renders. */
    reportID: string | undefined;
};

/**
 * Thin wrapper around today's screen-level `ReportActionsList` orchestrator.
 *
 * The orchestrator currently sources its `reportID` from `useRoute()`. For this slice
 * we accept a `reportID` prop on the `TaskReport.Actions` block to match the no-`useRoute`
 * contract for compound blocks; today the prop is unused at runtime because the
 * orchestrator below us still resolves the same id via the route. Once issue 02 makes
 * the orchestrator accept its id as a prop, the value flows straight through.
 */
// The orchestrator below resolves its `reportID` via `useRoute()` today; the prop on
// the wrapper is recorded in the type so downstream callers commit to the no-`useRoute`
// contract, and so issue 02's prop-driven orchestrator can flow it straight through.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- See block comment above.
function Actions({reportID}: ActionsProps) {
    return <ReportActionsList />;
}

Actions.displayName = 'TaskReport.Actions';

export default Actions;
