import React from 'react';
import {useLiveTransactionField} from '@components/MoneyRequestView/contexts/LiveTransactionProvider';
import {useSnapshotTransactionField} from '@components/MoneyRequestView/contexts/SnapshotTransactionProvider';
import {useFieldEditPermission, useParentReportID, useTransactionThreadReport} from '@components/MoneyRequestView/contexts/ThreadProvider';
import {useTransactionPolicyID} from '@components/MoneyRequestView/contexts/TransactionPolicyContext';
import FieldRow from '@components/MoneyRequestView/FieldRow';
import useActiveRoute from '@hooks/useActiveRoute';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import {useReportAttributesByID} from '@hooks/useReportAttributes';
import {canSubmitPerDiemExpenseFromWorkspace} from '@libs/PolicyUtils';
import {getReportName} from '@libs/ReportNameUtils';
import {isInvoiceReport} from '@libs/ReportUtils';
import {isExpenseUnreported as isExpenseUnreportedTransactionUtils, isPerDiemRequest as isPerDiemRequestTransactionUtils} from '@libs/TransactionUtils';
import Navigation from '@navigation/Navigation';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Transaction} from '@src/types/onyx';
import type {ReportAttributesDerivedValue} from '@src/types/onyx/DerivedValues';

function ReportRow() {
    const {translate} = useLocalize();
    const {getReportRHPActiveRoute} = useActiveRoute();

    const transaction = useLiveTransactionField((tx: Transaction) => tx);
    const canEditReportBase = useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.REPORT);
    const transactionThreadReport = useTransactionThreadReport();
    const parentReportID = useParentReportID();
    const policyID = useTransactionPolicyID();

    const [parentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${parentReportID}`);
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`);
    const [lastVisitedPath] = useOnyx(ONYXKEYS.LAST_VISITED_PATH);
    const reportAttributes = useReportAttributesByID(parentReport?.reportID);

    const isExpenseUnreported = isExpenseUnreportedTransactionUtils(transaction);
    const isPerDiemRequest = isPerDiemRequestTransactionUtils(transaction);
    const perDiemGate = !isPerDiemRequest || canSubmitPerDiemExpenseFromWorkspace(policy) || (isExpenseUnreported && !!policy);
    const canEditReport = canEditReportBase && perDiemGate;

    if (!parentReportID) {
        return null;
    }

    const reportAttributesByID = reportAttributes && parentReport?.reportID ? ({[parentReport.reportID]: reportAttributes} as ReportAttributesDerivedValue['reports']) : undefined;
    const reportName = getReportName(parentReport, reportAttributesByID) || parentReport?.reportName;
    const reportCopyValue = !canEditReport && reportName !== translate('common.none') ? reportName : undefined;
    const iouType = isInvoiceReport(parentReport) ? CONST.IOU.TYPE.INVOICE : CONST.IOU.TYPE.SUBMIT;

    function onPress() {
        if (!canEditReport || !transactionThreadReport || !transaction?.transactionID) {
            return;
        }
        Navigation.navigate(
            ROUTES.MONEY_REQUEST_STEP_REPORT.getRoute(
                CONST.IOU.ACTION.EDIT,
                iouType,
                transaction.transactionID,
                transactionThreadReport.reportID,
                getReportRHPActiveRoute() || lastVisitedPath,
            ),
        );
    }

    return (
        <FieldRow
            pendingAction={transaction?.pendingFields?.reportID}
            shouldShowRightIcon={canEditReport}
            title={reportName}
            description={translate('common.report')}
            onPress={onPress}
            interactive={canEditReport}
            shouldRenderAsHTML
            copyValue={reportCopyValue}
            copyable={!!reportCopyValue}
        />
    );
}

function ReportRowSnapshot() {
    const {translate} = useLocalize();
    const reportName = useSnapshotTransactionField((tx: Transaction) => tx?.reportName);

    if (!reportName) {
        return null;
    }

    return (
        <FieldRow
            title={reportName}
            description={translate('common.report')}
            interactive={false}
            shouldShowRightIcon={false}
        />
    );
}

export {ReportRow, ReportRowSnapshot};
