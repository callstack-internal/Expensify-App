import type {ReactNode} from 'react';
import React from 'react';

type SplitPaneLayoutProps = {
    /** Optional `backTo` route param. Reserved for future split-pane chrome to consume. */
    backTo?: string;

    /** Compound or fallthrough body that the layout wraps. */
    children: ReactNode;
};

/**
 * Layout primitive for `SCREENS.REPORT` (split-pane / central pane).
 *
 * NOTE: This first decomposition slice intentionally keeps the layout as a pass-through
 * wrapper. Today's `ReportScreen` fallthrough still owns the `ScreenWrapper` chrome,
 * so wrapping the chrome here would double-mount it. Once every kind has migrated to a
 * compound that owns its own `ScreenWrapper`, this layout will absorb the split-pane
 * chrome, narrow-modal pull-up handling and keyboard avoidance described in the PRD.
 *
 * `backTo` is plumbed through as a prop today so the API is stable for that future move.
 */
// `backTo` is documented in the prop contract for forward-compatibility: future
// split-pane chrome will read it. The pass-through layout does not consume it today.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- See block comment above.
function SplitPaneLayout({children, backTo}: SplitPaneLayoutProps) {
    // eslint-disable-next-line react/jsx-no-useless-fragment -- Pass-through wrapper today; future slice replaces this with split-pane chrome.
    return <>{children}</>;
}

SplitPaneLayout.displayName = 'SplitPaneLayout';

export default SplitPaneLayout;
