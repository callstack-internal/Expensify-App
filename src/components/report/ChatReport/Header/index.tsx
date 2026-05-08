import React from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import useOnyx from '@hooks/useOnyx';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import HeaderView from '@pages/inbox/HeaderView';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import HeaderSkeleton from './HeaderSkeleton';

type HeaderProps = {
    /** Identity of the chat-style report being rendered. */
    reportID: string | undefined;

    /**
     * Back-button handler resolved at the screen-equivalent boundary (the compound
     * shell). The shell owns `useRoute()`/`backTo`; this block accepts the function as
     * a prop so it can stay `useRoute`-free per the no-route-in-blocks contract.
     */
    onBackButtonPress: (prioritizeBackTo?: boolean) => void;
};

// Narrow projection — mirrors today's `ReportHeader` logic so the visible behavior
// is unchanged. Reading via a narrow selector keeps the block from re-rendering on
// every unrelated report-record change. The selector's return type is inferred and
// flows through `useOnyx` to `OfflineWithFeedback`'s `pendingAction` / `errors`.
const headerOfflineSelector = (r: OnyxEntry<OnyxTypes.Report>) => ({
    exists: !!r,
    pendingAction: r?.pendingFields?.addWorkspaceRoom ?? r?.pendingFields?.createChat ?? r?.pendingFields?.createReport ?? r?.pendingFields?.reportName ?? r?.pendingFields?.reimbursed,
    errors: r?.errorFields?.addWorkspaceRoom ?? r?.errorFields?.createChat ?? r?.errorFields?.createReport,
});

/**
 * Chat-report header block. Mounts today's `HeaderView` (which self-subscribes to
 * the report via `reportID` and renders the chat-style avatars + title layout, with
 * leaf-level conditionals for room subtitle, self-DM display, archived/anonymous
 * variants — all sub-kind variants of "chat", not separate compound branches).
 *
 * Self-subscribes via `reportID` to decide between the skeleton and the real header,
 * and to surface offline pending/error state on the surrounding `OfflineWithFeedback`
 * wrapper. Does NOT branch on `isReportTransactionThread` / money-request kinds —
 * kind detection is the dispatcher's job; this block trusts the dispatcher's decision
 * and only owns the "data ready?" check that decides between the skeleton and the
 * real header.
 */
function Header({reportID, onBackButtonPress}: HeaderProps) {
    const onyxReportID = getNonEmptyStringOnyxID(reportID);
    const [offline] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${onyxReportID}`, {selector: headerOfflineSelector});

    if (!offline?.exists) {
        return <HeaderSkeleton />;
    }

    return (
        <OfflineWithFeedback
            pendingAction={offline.pendingAction}
            errors={offline.errors}
            shouldShowErrorMessages={false}
            needsOffscreenAlphaCompositing
        >
            <HeaderView
                reportID={onyxReportID}
                onNavigationMenuButtonClicked={onBackButtonPress}
            />
        </OfflineWithFeedback>
    );
}

Header.displayName = 'ChatReport.Header';

export default Header;
