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
    /** Identity of the task report being rendered. */
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
// every unrelated report-record change.
const headerOfflineSelector = (r: OnyxEntry<OnyxTypes.Report>) => ({
    exists: !!r,
    pendingAction: r?.pendingFields?.addWorkspaceRoom ?? r?.pendingFields?.createChat ?? r?.pendingFields?.createReport ?? r?.pendingFields?.reportName ?? r?.pendingFields?.reimbursed,
    errors: r?.errorFields?.addWorkspaceRoom ?? r?.errorFields?.createChat ?? r?.errorFields?.createReport,
});

/**
 * Task-report header block. Mounts today's `HeaderView` (which self-subscribes to the
 * report via `reportID` and renders the task-style content — task title, completion
 * checkbox, assignee row, and `TaskHeaderActionButton` — in its task branch).
 *
 * Self-subscribes via `reportID` to decide between the skeleton and the real header,
 * and to surface offline pending/error state on the surrounding `OfflineWithFeedback`
 * wrapper. Does NOT branch on report kind — kind detection is the dispatcher's job.
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

Header.displayName = 'TaskReport.Header';

export default Header;
