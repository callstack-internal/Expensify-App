import type {ReactElement} from 'react';
import React from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import ReportShellSkeleton from '@components/report/ReportShellSkeleton';
import BootstrapFetcher from '@components/report/shared/BootstrapFetcher';
import TaskReport from '@components/report/TaskReport';
import useOnyx from '@hooks/useOnyx';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';

type DispatcherSelectorReport = {
    type: OnyxTypes.Report['type'];
    chatType: OnyxTypes.Report['chatType'];
    parentReportID: OnyxTypes.Report['parentReportID'];
    transactionCount: OnyxTypes.Report['transactionCount'];
};

type ParentSelectorReport = {
    type: OnyxTypes.Report['type'];
    chatType: OnyxTypes.Report['chatType'];
};

const reportSelector = (r: OnyxEntry<OnyxTypes.Report>): DispatcherSelectorReport | null =>
    r
        ? {
              type: r.type,
              chatType: r.chatType,
              parentReportID: r.parentReportID,
              transactionCount: r.transactionCount,
          }
        : null;

const parentReportSelector = (r: OnyxEntry<OnyxTypes.Report>): ParentSelectorReport | null =>
    r
        ? {
              type: r.type,
              chatType: r.chatType,
          }
        : null;

/**
 * Slots for the compounds that have not yet been authored. Each slot defaults to the
 * supplied `fallthrough` element. Tests inject sentinel components to assert the
 * dispatcher's branch decisions; production never passes `slots` and therefore renders
 * the route's `fallthrough` for every non-task branch.
 */
type DispatcherSlots = {
    /** Multi-transaction money-request top-level report. */
    moneyRequestReport?: ReactElement;
    /** Single-transaction money-request top-level report, or actual transaction-thread. */
    transactionThread?: ReactElement;
    /** Chat root, chat thread on a chat parent. */
    chatReport?: ReactElement;
};

type ReportKindDispatcherProps = {
    /** Identity of the report being rendered. */
    reportID: string | undefined;

    /** Optional linked-action id (chat-stream routes only). */
    reportActionID?: string;

    /** Optional analytics tag describing how the user reached this report. */
    referrer?: string;

    /**
     * Element to render for kinds that have not yet migrated to the new compound
     * architecture. Each route body picks the right fallthrough for its screen
     * (today's `ReportScreen` for the chat-stream routes, today's
     * `SearchMoneyRequestReportPage` for the money-request RHP routes) and passes it
     * in as a prop. The dispatcher is route-agnostic.
     */
    fallthrough: ReactElement;

    /** Optional per-branch slot overrides for testing. */
    slots?: DispatcherSlots;
};

/**
 * Render-time kind dispatcher. The single place in the new architecture that branches on
 * report kind. Selector projections keep the dispatcher's Onyx footprint to four scalars
 * on the report and two on the parent. When the report has no parent, the parent
 * subscription targets the phantom `report_undefined` key (never written), so top-level
 * reports never subscribe to a real parent record.
 *
 * In this first decomposition slice the only kind that maps to a new compound is `TASK`.
 * Every other kind renders the `fallthrough` element supplied by the caller route (or a
 * test slot, when supplied), which preserves today's behavior exactly. Subsequent slices
 * replace each fallthrough with its compound.
 */
function ReportKindDispatcher({reportID, reportActionID, referrer, fallthrough, slots}: ReportKindDispatcherProps) {
    const onyxReportID = getNonEmptyStringOnyxID(reportID);

    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${onyxReportID}`, {
        selector: reportSelector,
    });

    // When `parentReportID` is missing (top-level report) we still call `useOnyx` to keep
    // hook order stable, but interpolate `undefined` so the subscription targets the
    // phantom `report_undefined` key. That key is never written, so the dispatcher
    // never subscribes to a real parent report when there is no parent to read.
    const parentReportID = report?.parentReportID;
    const [parentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${parentReportID}`, {selector: parentReportSelector});

    if (!report) {
        return (
            <>
                <BootstrapFetcher reportID={onyxReportID} />
                <ReportShellSkeleton />
            </>
        );
    }

    if (report.type === CONST.REPORT.TYPE.TASK) {
        return (
            <>
                <BootstrapFetcher reportID={onyxReportID} />
                <TaskReport
                    reportID={onyxReportID}
                    reportActionID={reportActionID}
                    referrer={referrer}
                />
            </>
        );
    }

    // Top-level (no parent) money-request kinds — split by transaction count.
    if (!report.parentReportID) {
        const isMoneyRequestKind = report.type === CONST.REPORT.TYPE.IOU || report.type === CONST.REPORT.TYPE.EXPENSE || report.type === CONST.REPORT.TYPE.INVOICE;
        if (isMoneyRequestKind) {
            const isMultiTransaction = (report.transactionCount ?? 0) > 1;
            if (isMultiTransaction) {
                return slots?.moneyRequestReport ?? fallthrough;
            }
            return slots?.transactionThread ?? fallthrough;
        }
        return slots?.chatReport ?? fallthrough;
    }

    // Has parent — transaction thread vs chat thread.
    const parentIsMoneyRequest = parentReport?.type === CONST.REPORT.TYPE.IOU || parentReport?.type === CONST.REPORT.TYPE.EXPENSE || parentReport?.type === CONST.REPORT.TYPE.INVOICE;
    const parentIsSelfDM = parentReport?.chatType === CONST.REPORT.CHAT_TYPE.SELF_DM;
    if (parentIsMoneyRequest || parentIsSelfDM) {
        return slots?.transactionThread ?? fallthrough;
    }
    return slots?.chatReport ?? fallthrough;
}

ReportKindDispatcher.displayName = 'ReportKindDispatcher';

export default ReportKindDispatcher;
