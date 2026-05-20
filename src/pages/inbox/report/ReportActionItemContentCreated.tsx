import React from 'react';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import MoneyRequestViewInThread from '@components/MoneyRequestView/MoneyRequestViewInThread';
import {AmountRow} from '@components/MoneyRequestView/rows/AmountRow';
import {AttendeesRow} from '@components/MoneyRequestView/rows/AttendeesRow';
import {BillableRow} from '@components/MoneyRequestView/rows/BillableRow';
import {CardRow} from '@components/MoneyRequestView/rows/CardRow';
import {CategoryRow} from '@components/MoneyRequestView/rows/CategoryRow';
import CompanyCardConnectionWarning from '@components/MoneyRequestView/rows/CompanyCardConnectionWarning';
import {DateRow} from '@components/MoneyRequestView/rows/DateRow';
import {DescriptionRow} from '@components/MoneyRequestView/rows/DescriptionRow';
import {MerchantOrDistanceRow} from '@components/MoneyRequestView/rows/MerchantOrDistanceRow';
import {ReceiptCard} from '@components/MoneyRequestView/rows/ReceiptCard';
import {ReimbursableRow} from '@components/MoneyRequestView/rows/ReimbursableRow';
import {ReportRow} from '@components/MoneyRequestView/rows/ReportRow';
import {TagRows} from '@components/MoneyRequestView/rows/TagRows';
import {TaxRow} from '@components/MoneyRequestView/rows/TaxRow';
import {TransactionViolationsBlock} from '@components/MoneyRequestView/rows/TransactionViolationsBlock';
import {ViewTripDetailsRow} from '@components/MoneyRequestView/rows/ViewTripDetailsRow';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import RenderHTML from '@components/RenderHTML';
import TaskView from '@components/ReportActionItem/TaskView';
import {ShowContextMenuActionsContext, ShowContextMenuStateContext, useShowContextMenuActions, useShowContextMenuState} from '@components/ShowContextMenuContext';
import SpacerView from '@components/SpacerView';
import UnreadActionIndicator from '@components/UnreadActionIndicator';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import usePolicy from '@hooks/usePolicy';
import useThemeStyles from '@hooks/useThemeStyles';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {isMessageDeleted, isReversedTransaction as isReversedTransactionReportActionsUtils, isTransactionThread} from '@libs/ReportActionsUtils';
import {isCanceledTaskReport, isExpenseReport, isInvoiceReport, isIOUReport, isTaskReport} from '@libs/ReportUtils';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import AnimatedEmptyStateBackground from './AnimatedEmptyStateBackground';
import MoneyReportContentCreated from './MoneyReportContentCreated';
import ReportActionItemCreated from './ReportActionItemCreated';
import ReportActionItemSingle from './ReportActionItemSingle';

type ReportActionItemContentCreatedProps = {
    /** Report action belonging to the report's parent */
    parentReportAction: OnyxEntry<OnyxTypes.ReportAction>;

    /** The transaction ID */
    transactionID: string | undefined;

    /** The draft message */
    draftMessage: string | undefined;

    /** Flag to show, hide the thread divider line */
    shouldHideThreadDividerLine: boolean;
};

function ReportActionItemContentCreated({parentReportAction, transactionID, draftMessage, shouldHideThreadDividerLine}: ReportActionItemContentCreatedProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const contextMenuStateValue = useShowContextMenuState();
    const contextMenuActionsValue = useShowContextMenuActions();
    const {report, action, transactionThreadReport} = contextMenuStateValue;
    const policy = usePolicy(report?.policyID === CONST.POLICY.OWNER_EMAIL_FAKE ? undefined : report?.policyID);
    const [transaction] = useOnyx(`${ONYXKEYS.COLLECTION.TRANSACTION}${getNonEmptyStringOnyxID(transactionID)}`);
    const [parentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getNonEmptyStringOnyxID(report?.parentReportID)}`);

    const renderThreadDivider = shouldHideThreadDividerLine ? (
        <UnreadActionIndicator
            reportActionID={report?.reportID}
            shouldHideThreadDividerLine={shouldHideThreadDividerLine}
        />
    ) : (
        <SpacerView
            shouldShow={!shouldHideThreadDividerLine}
            style={[!shouldHideThreadDividerLine ? styles.reportHorizontalRule : {}]}
        />
    );

    const disabledStateValue = {...contextMenuStateValue, isDisabled: true};

    if (isTransactionThread(parentReportAction)) {
        const isReversedTransaction = isReversedTransactionReportActionsUtils(parentReportAction);

        if (isMessageDeleted(parentReportAction) || isReversedTransaction) {
            let message: TranslationPaths;

            if (isReversedTransaction) {
                message = 'parentReportAction.reversedTransaction';
            } else {
                message = 'parentReportAction.deletedExpense';
            }

            return (
                <View style={[styles.pRelative]}>
                    <AnimatedEmptyStateBackground />
                    <OfflineWithFeedback pendingAction={parentReportAction?.pendingAction ?? null}>
                        <ReportActionItemSingle
                            action={parentReportAction}
                            showHeader
                            report={report}
                        >
                            <RenderHTML html={`<deleted-action ${CONST.REVERSED_TRANSACTION_ATTRIBUTE}="${isReversedTransaction}">${translate(message)}</deleted-action>`} />
                        </ReportActionItemSingle>
                        <View style={styles.threadDividerLine} />
                    </OfflineWithFeedback>
                </View>
            );
        }

        return (
            <OfflineWithFeedback pendingAction={action?.pendingAction}>
                <ShowContextMenuStateContext.Provider value={disabledStateValue}>
                    <ShowContextMenuActionsContext.Provider value={contextMenuActionsValue}>
                        <View style={[styles.moneyRequestView]}>
                            <AnimatedEmptyStateBackground />
                            <MoneyRequestViewInThread
                                transactionID={transactionID}
                                parentReportID={report?.parentReportID}
                                policyID={policy?.id}
                            >
                                <ReceiptCard />
                                <AmountRow />
                                <DescriptionRow />
                                <MerchantOrDistanceRow />
                                <DateRow />
                                <CategoryRow />
                                <TagRows />
                                <TaxRow />
                                <CardRow />
                                <AttendeesRow />
                                <BillableRow />
                                <ReimbursableRow />
                                <ReportRow />
                                <ViewTripDetailsRow />
                                <TransactionViolationsBlock />
                                <CompanyCardConnectionWarning />
                            </MoneyRequestViewInThread>
                            {renderThreadDivider}
                        </View>
                    </ShowContextMenuActionsContext.Provider>
                </ShowContextMenuStateContext.Provider>
            </OfflineWithFeedback>
        );
    }

    if (isTaskReport(report)) {
        if (isCanceledTaskReport(report, parentReportAction)) {
            return (
                <View style={[styles.pRelative]}>
                    <AnimatedEmptyStateBackground />
                    <OfflineWithFeedback pendingAction={parentReportAction?.pendingAction}>
                        <ReportActionItemSingle
                            action={parentReportAction}
                            showHeader={draftMessage === undefined}
                            report={report}
                        >
                            <RenderHTML html={`<deleted-action>${translate('parentReportAction.deletedTask')}</deleted-action>`} />
                        </ReportActionItemSingle>
                    </OfflineWithFeedback>
                    <View style={styles.reportHorizontalRule} />
                </View>
            );
        }

        return (
            <View style={[styles.pRelative]}>
                <AnimatedEmptyStateBackground />
                <View>
                    {/* TaskView opens its own ShowContextMenu* providers with task-scoped, disabled values, so no wrapping needed here. */}
                    <TaskView
                        report={report}
                        parentReport={parentReport}
                        action={action}
                    />
                    {renderThreadDivider}
                </View>
            </View>
        );
    }

    if (isExpenseReport(report) || isIOUReport(report) || isInvoiceReport(report)) {
        return (
            <MoneyReportContentCreated
                report={report}
                policy={policy}
                transaction={transaction}
                transactionThreadReport={transactionThreadReport}
                action={action}
                shouldHideThreadDividerLine={shouldHideThreadDividerLine}
                threadDivider={renderThreadDivider}
            />
        );
    }

    return (
        <ReportActionItemCreated
            reportID={report?.reportID}
            policyID={report?.policyID}
        />
    );
}

export default ReportActionItemContentCreated;
