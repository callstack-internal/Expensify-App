import React from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import MoneyReportHeader from '@components/MoneyReportHeader';
import useOnyx from '@hooks/useOnyx';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import HeaderSkeleton from './HeaderSkeleton';

type HeaderProps = {
    /** Identity of the multi-transaction money-request report being rendered. */
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
 * Multi-transaction money-request header block. Mounts today's `MoneyReportHeader`
 * (which self-subscribes to the report via `reportID` and renders the total amount
 * and status row for multi-tx money-request reports). Single-tx reports are handled
 * by `TransactionThread.Header`; this block is mounted only when the dispatcher has
 * already determined `transactionCount > 1`.
 *
 * Self-subscribes via `reportID` to decide between the skeleton and the real header.
 * Does NOT branch on report kind — the dispatcher owns kind detection; this block
 * trusts that decision and only owns the "data ready?" check.
 */
function Header({reportID, onBackButtonPress}: HeaderProps) {
    const onyxReportID = getNonEmptyStringOnyxID(reportID);
    const [reportExists] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${onyxReportID}`, {selector: reportExistsSelector});

    if (!reportExists) {
        return <HeaderSkeleton />;
    }

    return (
        <MoneyReportHeader
            reportID={onyxReportID}
            shouldDisplayBackButton
            onBackButtonPress={() => onBackButtonPress()}
        />
    );
}

Header.displayName = 'MoneyRequestReport.Header';

export default Header;
