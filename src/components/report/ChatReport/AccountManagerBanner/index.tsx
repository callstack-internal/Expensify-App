import React from 'react';
import AccountManagerBannerInternal from '@pages/inbox/AccountManagerBanner';

type AccountManagerBannerProps = {
    /** Identity of the chat-style report being rendered. */
    reportID: string | undefined;
};

/**
 * Account-manager banner block. Always mounted in the `ChatReport` shell; self-renders
 * the concierge banner content for concierge reports and returns null for every other
 * chat sub-kind.
 *
 * The "is this concierge?" decision lives entirely inside today's
 * `@pages/inbox/AccountManagerBanner` (it self-subscribes to the report record and
 * the account's manager id, then calls `isConciergeChatReport` from `ReportUtils`).
 * This block is a thin wrapper that forwards `reportID` so the banner can self-decide.
 * No kind-detection branches in the wrapper — the decision is delegated to the leaf,
 * matching CLEAN-REACT-PATTERNS-2 (self-subscribing components) and the no-kind-
 * detection-in-compound-blocks contract.
 */
function AccountManagerBanner({reportID}: AccountManagerBannerProps) {
    return <AccountManagerBannerInternal reportID={reportID} />;
}

AccountManagerBanner.displayName = 'ChatReport.AccountManagerBanner';

export default AccountManagerBanner;
