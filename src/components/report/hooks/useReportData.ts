import {useSearchStateContext} from '@components/Search/SearchContext';
import useOnyx from '@hooks/useOnyx';
import useReportTransactionsCollection from '@hooks/useReportTransactionsCollection';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, Transaction} from '@src/types/onyx';

type ReportDataResult = {
    /** Report record — either from Onyx or extracted from the search snapshot. `null` when both are empty. */
    report: Report | null;

    /** Transactions for the report — Onyx values when populated, snapshot values otherwise, empty array when neither has data. */
    transactions: Transaction[];
};

/**
 * Source of truth for "what data does a `MoneyRequestReport` block render?". Reads
 * `REPORT[reportID]` and the derived per-report transactions collection from Onyx;
 * when Onyx is empty AND the search snapshot carries the report (cold-deep-link from
 * a search result), extracts the report and its transactions from the snapshot.
 *
 * Keeps snapshot-awareness behind one hook so blocks call `useReportData` and never
 * see `SearchContext` for data. Onyx is never written to from snapshot.
 */
function useReportData(reportID: string | undefined): ReportDataResult {
    const onyxReportID = getNonEmptyStringOnyxID(reportID);
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${onyxReportID}`);
    const transactionsCollection = useReportTransactionsCollection(onyxReportID);

    const {currentSearchResults} = useSearchStateContext();

    // Onyx-first: when the report record exists in Onyx, never consult the snapshot.
    // Onyx values may be `undefined` (key missing) or `null` (cleared); both are
    // treated as "not populated yet".
    if (report) {
        const onyxTransactions = Object.values(transactionsCollection ?? {}).filter((t): t is Transaction => !!t);
        return {report, transactions: onyxTransactions};
    }

    // Snapshot fallback path. The snapshot is keyed by `${COLLECTION.SNAPSHOT}${hash}`
    // and its `data` map mirrors Onyx keys (`${COLLECTION.REPORT}${id}`,
    // `${COLLECTION.TRANSACTION}${id}`, etc). We extract the report whose key matches
    // the requested id, plus any transactions whose `reportID` matches.
    const snapshotData = currentSearchResults?.data as Record<string, unknown> | undefined;
    if (!snapshotData || !onyxReportID) {
        return {report: null, transactions: []};
    }

    const reportKey = `${ONYXKEYS.COLLECTION.REPORT}${onyxReportID}`;
    const snapshotReport = (snapshotData[reportKey] as Report | undefined) ?? null;

    const snapshotTransactions: Transaction[] = [];
    for (const key of Object.keys(snapshotData)) {
        if (!key.startsWith(ONYXKEYS.COLLECTION.TRANSACTION) || key.startsWith(ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS) || key.startsWith(ONYXKEYS.COLLECTION.TRANSACTION_DRAFT)) {
            continue;
        }
        const candidate = snapshotData[key] as Transaction | undefined;
        if (candidate?.reportID === onyxReportID) {
            snapshotTransactions.push(candidate);
        }
    }

    return {report: snapshotReport, transactions: snapshotTransactions};
}

export default useReportData;
export type {ReportDataResult};
