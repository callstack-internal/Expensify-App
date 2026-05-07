import React from 'react';
import ReportActionCompose from '@pages/inbox/report/ReportActionCompose/ReportActionCompose';

type ComposerProps = {
    /** Identity of the task report whose composer this block renders. */
    reportID: string;
};

/**
 * Thin wrapper around today's `ReportActionCompose`. Today's component already accepts
 * `reportID` as a prop and self-subscribes, so the wrapper is a one-line passthrough.
 * Kept as its own block so the compound surface is symmetric with `Header` / `Actions`,
 * and so issue 02 can replace it with the kind-specific composer behavior without
 * renaming any imports.
 */
function Composer({reportID}: ComposerProps) {
    return <ReportActionCompose reportID={reportID} />;
}

Composer.displayName = 'TaskReport.Composer';

export default Composer;
