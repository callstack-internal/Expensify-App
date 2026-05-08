import React from 'react';
import ReportFooter from '@pages/inbox/report/ReportFooter';

type ComposerProps = {
    /** Identity of the task report whose composer this block renders. */
    reportID: string | undefined;
};

/**
 * Thin wrapper around today's `ReportFooter` — the screen-level orchestrator that
 * decides between the live composer (`ReportActionCompose`) and the archive /
 * blocked / system / admins-only footer variants. Wrapping `ReportFooter` (instead
 * of `ReportActionCompose` directly) preserves the archive banner and gating
 * semantics today's `ReportScreen` provided for task reports.
 *
 * Today's `ReportFooter` resolves `reportID` via `useRoute()` itself, so the prop on
 * this block is unused at runtime. It appears on the prop type for parity with the
 * other blocks and so a follow-up that makes `ReportFooter` accept its id as a prop
 * will flow it straight through without renaming any imports.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- See block comment above.
function Composer({reportID}: ComposerProps) {
    return <ReportFooter />;
}

Composer.displayName = 'TaskReport.Composer';

export default Composer;
