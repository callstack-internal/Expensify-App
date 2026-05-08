import type {ReactElement} from 'react';
import React from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import ChatReport from '@components/report/ChatReport';
import MoneyRequestReport from '@components/report/MoneyRequestReport';
import ReportShellSkeleton from '@components/report/ReportShellSkeleton';
import BootstrapFetcher from '@components/report/shared/BootstrapFetcher';
import TaskReport from '@components/report/TaskReport';
import TransactionThread from '@components/report/TransactionThread';
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
 * Per-branch slot overrides for testing. Production never passes `slots`; tests inject
 * sentinel components to assert the dispatcher's branch decisions.
 */
type DispatcherSlots = {
    /** Multi-transaction money-request top-level report. */
    moneyRequestReport?: ReactElement;
    /** Single-transaction money-request top-level report, or actual transaction-thread. */
    transactionThread?: ReactElement;
    /** Chat root, chat thread on a chat parent. */
    chatReport?: ReactElement;
    /** Task report. */
    taskReport?: ReactElement;
};

type ReportKindDispatcherProps = {
    /** Identity of the report being rendered. */
    reportID: string | undefined;

    /** Optional linked-action id (chat-stream routes only). */
    reportActionID?: string;

    /** Optional analytics tag describing how the user reached this report. */
    referrer?: string;

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
 * Every branch mounts a real compound: `TaskReport`, `TransactionThread`, `ChatReport`,
 * `MoneyRequestReport`. There is no fallthrough — the decomposition is complete.
 */
function ReportKindDispatcher({reportID, reportActionID, referrer, slots}: ReportKindDispatcherProps) {
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
            slots?.taskReport ?? (
                <>
                    <BootstrapFetcher reportID={onyxReportID} />
                    <TaskReport
                        reportID={onyxReportID}
                        reportActionID={reportActionID}
                        referrer={referrer}
                    />
                </>
            )
        );
    }

    // Top-level (no parent) money-request kinds — split by transaction count.
    if (!report.parentReportID) {
        const isMoneyRequestKind = report.type === CONST.REPORT.TYPE.IOU || report.type === CONST.REPORT.TYPE.EXPENSE || report.type === CONST.REPORT.TYPE.INVOICE;
        if (isMoneyRequestKind) {
            const isMultiTransaction = (report.transactionCount ?? 0) > 1;
            if (isMultiTransaction) {
                return (
                    slots?.moneyRequestReport ?? (
                        <>
                            <BootstrapFetcher reportID={onyxReportID} />
                            <MoneyRequestReport
                                reportID={onyxReportID}
                                referrer={referrer}
                            />
                        </>
                    )
                );
            }
            return (
                slots?.transactionThread ?? (
                    <>
                        <BootstrapFetcher reportID={onyxReportID} />
                        <TransactionThread
                            reportID={onyxReportID}
                            reportActionID={reportActionID}
                            referrer={referrer}
                        />
                    </>
                )
            );
        }
        return (
            slots?.chatReport ?? (
                <>
                    <BootstrapFetcher reportID={onyxReportID} />
                    <ChatReport
                        reportID={onyxReportID}
                        reportActionID={reportActionID}
                        referrer={referrer}
                    />
                </>
            )
        );
    }

    // Has parent — transaction thread vs chat thread.
    const parentIsMoneyRequest = parentReport?.type === CONST.REPORT.TYPE.IOU || parentReport?.type === CONST.REPORT.TYPE.EXPENSE || parentReport?.type === CONST.REPORT.TYPE.INVOICE;
    const parentIsSelfDM = parentReport?.chatType === CONST.REPORT.CHAT_TYPE.SELF_DM;
    if (parentIsMoneyRequest || parentIsSelfDM) {
        return (
            slots?.transactionThread ?? (
                <>
                    <BootstrapFetcher reportID={onyxReportID} />
                    <TransactionThread
                        reportID={onyxReportID}
                        reportActionID={reportActionID}
                        referrer={referrer}
                    />
                </>
            )
        );
    }
    return (
        slots?.chatReport ?? (
            <>
                <BootstrapFetcher reportID={onyxReportID} />
                <ChatReport
                    reportID={onyxReportID}
                    reportActionID={reportActionID}
                    referrer={referrer}
                />
            </>
        )
    );
}

ReportKindDispatcher.displayName = 'ReportKindDispatcher';

export default ReportKindDispatcher;
