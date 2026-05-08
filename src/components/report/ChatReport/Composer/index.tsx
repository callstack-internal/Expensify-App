import React from 'react';
import {useReply} from '@components/report/ChatReport/ReplyContextProvider/ReplyContext';
import ReportFooter from '@pages/inbox/report/ReportFooter';

type ComposerProps = {
    /** Identity of the chat-style report being rendered. */
    reportID: string | undefined;
};

/**
 * Thin wrapper around today's `ReportFooter` — the screen-level orchestrator that
 * decides between the live composer (`ReportActionCompose`) and the archive /
 * anonymous / blocked / system / admins-only footer variants. Wrapping `ReportFooter`
 * (instead of `ReportActionCompose` directly) preserves the archive banner and gating
 * semantics today's `ReportScreen` provides for chat-style reports — losing those
 * would regress the visible UX, which Issue 03 is not allowed to do.
 *
 * State consumer of `useReply()`. Today the value is observed but not yet rendered:
 * `ReportFooter` mounts `ReportActionCompose` which owns its own input; a follow-up
 * slice composes the reply preview line above the input by reading `useReply()` here
 * directly. The hook call lives in this block today so the compound surface commits
 * to the state-consumer contract — the render-counter test relies on it.
 *
 * Today's `ReportFooter` resolves `reportID` via `useRoute()` itself, so the prop on
 * this block is unused at runtime. It appears on the prop type for parity with the
 * other blocks and so a follow-up that makes `ReportFooter` accept its id as a prop
 * will flow it straight through without renaming any imports.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- See block comment above.
function Composer({reportID}: ComposerProps) {
    // Subscribe to the reply state so this block participates in the reply-context
    // contract (state consumer). Today the value is read but unused; a follow-up
    // wires the preview line above the composer input.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const reply = useReply();

    return <ReportFooter />;
}

Composer.displayName = 'ChatReport.Composer';

export default Composer;
