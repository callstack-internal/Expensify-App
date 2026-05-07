import type {ReactNode} from 'react';
import React from 'react';

type RHPLayoutProps = {
    /** Optional `backTo` route param. Reserved for future RHP shell to consume. */
    backTo?: string;

    /** Compound or fallthrough body that the layout wraps. */
    children: ReactNode;
};

/**
 * Layout primitive for the RHP-mounted report screens
 * (`SCREENS.RIGHT_MODAL.SEARCH_REPORT`, `SCREENS.RIGHT_MODAL.SEARCH_MONEY_REQUEST_REPORT`,
 * `SCREENS.RIGHT_MODAL.EXPENSE_REPORT`).
 *
 * NOTE: This first decomposition slice keeps the layout as a pass-through wrapper.
 * Today's `RHPReportScreen` / `SearchMoneyRequestReportPage` fallthrough still owns the RHP
 * shell. Width is decided by the existing `WideRHPContextProvider` machinery, not by this
 * layout. Once every kind has migrated to its own compound, this layout will own the RHP
 * shell. `backTo` is plumbed through today so the API is stable for that future move.
 */
// `backTo` is documented in the prop contract for forward-compatibility: future
// RHP shell will read it. The pass-through layout does not consume it today.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- See block comment above.
function RHPLayout({children, backTo}: RHPLayoutProps) {
    // eslint-disable-next-line react/jsx-no-useless-fragment -- Pass-through wrapper today; future slice replaces this with RHP shell.
    return <>{children}</>;
}

RHPLayout.displayName = 'RHPLayout';

export default RHPLayout;
