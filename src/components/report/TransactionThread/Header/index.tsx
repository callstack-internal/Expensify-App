import React from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import MoneyRequestHeader from '@components/MoneyRequestHeader';
import useOnyx from '@hooks/useOnyx';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import HeaderSkeleton from './HeaderSkeleton';

type HeaderProps = {
    /** Identity of the transaction-thread or top-level single-tx report being rendered. */
    reportID: string | undefined;

    /**
     * Back-button handler resolved at the screen-equivalent boundary (the compound
     * shell). The shell owns `useRoute()`/`backTo`; this block accepts the function as
     * a prop so it can stay `useRoute`-free per the no-route-in-blocks contract.
     */
    onBackButtonPress: (prioritizeBackTo?: boolean) => void;
};

// Existence-only selector — the skeleton vs real-header decision needs only "report
// exists". Avoids re-rendering the block on every unrelated report-record change.
const reportExistsSelector = (r: OnyxEntry<OnyxTypes.Report>): boolean => !!r;

/**
 * Transaction-thread header block. Mounts today's `MoneyRequestHeader` (which
 * self-subscribes to the report via `reportID` and renders the single-transaction
 * amount/merchant/date layout for both real transaction-thread reports and
 * top-level money-request reports with `transactionCount ≤ 1`).
 *
 * Self-subscribes via `reportID` to decide between the skeleton and the real header.
 * Does NOT branch on `isReportTransactionThread(report)` — kind detection is the
 * dispatcher's job; this block trusts the dispatcher's decision and only owns the
 * "data ready?" check that decides between the skeleton and the real header.
 */
function Header({reportID, onBackButtonPress}: HeaderProps) {
    const onyxReportID = getNonEmptyStringOnyxID(reportID);
    const [reportExists] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${onyxReportID}`, {selector: reportExistsSelector});

    if (!reportExists) {
        return <HeaderSkeleton />;
    }

    return (
        <MoneyRequestHeader
            reportID={onyxReportID}
            onBackButtonPress={onBackButtonPress}
        />
    );
}

Header.displayName = 'TransactionThread.Header';

export default Header;
