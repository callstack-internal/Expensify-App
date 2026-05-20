import React from 'react';
import {useLiveTransactionField} from '@components/MoneyRequestView/contexts/LiveTransactionProvider';
import {useSnapshotTransactionField} from '@components/MoneyRequestView/contexts/SnapshotTransactionProvider';
import {useCanEditTransaction, useParentReportID, useTransactionThreadReport} from '@components/MoneyRequestView/contexts/ThreadProvider';
import {useTransactionPolicyID} from '@components/MoneyRequestView/contexts/TransactionPolicyContext';
import {useFieldViolationMessages} from '@components/MoneyRequestView/contexts/ViolationsProvider';
import FieldRow from '@components/MoneyRequestView/FieldRow';
import {usePersonalDetails} from '@components/OnyxListItemProvider';
import UserPills from '@components/UserPills';
import {useCurrencyListActions} from '@hooks/useCurrencyList';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useThemeStyles from '@hooks/useThemeStyles';
import {enrichAndSortAttendees} from '@libs/AttendeeUtils';
import {isInvoiceReport} from '@libs/ReportUtils';
import {getAttendeesListDisplayString, isFromCreditCardImport as isCardTransactionTransactionUtils, shouldShowAttendees as shouldShowAttendeesTransactionUtils} from '@libs/TransactionUtils';
import Navigation from '@navigation/Navigation';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Transaction} from '@src/types/onyx';

function resolveIouType(parentReport: ReturnType<typeof useOnyx>[0]) {
    const report = parentReport as {invoiceReceiver?: unknown} | undefined;
    if (report && 'invoiceReceiver' in report && report.invoiceReceiver) {
        return CONST.IOU.TYPE.INVOICE;
    }
    if (isInvoiceReport(report as never)) {
        return CONST.IOU.TYPE.INVOICE;
    }
    return CONST.IOU.TYPE.SUBMIT;
}

function AttendeesRow() {
    const {translate, localeCompare} = useLocalize();
    const {convertToDisplayString} = useCurrencyListActions();
    const styles = useThemeStyles();
    const personalDetailsList = usePersonalDetails();

    const transaction = useLiveTransactionField((tx: Transaction) => tx);
    const canEdit = useCanEditTransaction();
    const transactionThreadReport = useTransactionThreadReport();
    const parentReportID = useParentReportID();
    const policyID = useTransactionPolicyID();
    const violationMessages = useFieldViolationMessages('attendees');

    const [parentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${parentReportID}`);
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`);

    const iouType = resolveIouType(parentReport);
    const shouldShow = shouldShowAttendeesTransactionUtils(iouType, policy);
    if (!shouldShow) {
        return null;
    }

    const attendees = enrichAndSortAttendees(transaction?.comment?.attendees, personalDetailsList, localeCompare);
    const attendeesTitle = Array.isArray(attendees) ? getAttendeesListDisplayString(attendees) : '';
    const attendeesCopyValue = !canEdit ? attendeesTitle : undefined;

    const amount = transaction?.amount;
    const currency = transaction?.currency;
    const formattedPerAttendeeAmount = amount !== undefined && Array.isArray(attendees) && attendees.length > 0 ? convertToDisplayString(amount / attendees.length, currency) : '';

    const description = `${translate('iou.attendees')} ${
        Array.isArray(attendees) && attendees.length > 1 && formattedPerAttendeeAmount ? `${CONST.DOT_SEPARATOR} ${formattedPerAttendeeAmount} ${translate('common.perPerson')}` : ''
    }`;

    const violationsError = violationMessages.length > 0 ? `${violationMessages.map((v) => v.name).join('. ')}.` : '';
    const brickRoadIndicator = violationsError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined;
    const isFromCardImport = isCardTransactionTransactionUtils(transaction);

    function onPress() {
        if (!transaction?.transactionID || !transactionThreadReport?.reportID) {
            return;
        }
        Navigation.navigate(ROUTES.MONEY_REQUEST_ATTENDEE.getRoute(CONST.IOU.ACTION.EDIT, iouType, transaction.transactionID, transactionThreadReport.reportID));
    }

    return (
        <FieldRow
            key="attendees"
            pendingAction={transaction?.pendingFields?.attendees}
            accessibilityLabel={`${translate('iou.attendees')}, ${attendeesTitle}`}
            description={description}
            descriptionTextStyle={styles.textLabelSupportingNormal}
            titleComponent={
                Array.isArray(attendees) ? (
                    <UserPills
                        users={attendees.map((a) => ({
                            avatar: a?.avatarUrl,
                            displayName: a?.displayName ?? a?.login ?? a?.email ?? '',
                            accountID: a?.accountID,
                            email: a?.email ?? a?.login,
                        }))}
                        maxVisible={canEdit ? undefined : attendees.length}
                    />
                ) : undefined
            }
            style={[styles.moneyRequestMenuItem]}
            titleStyle={styles.flex1}
            onPress={onPress}
            brickRoadIndicator={brickRoadIndicator}
            errorText={violationsError}
            interactive={canEdit && !isFromCardImport}
            shouldShowRightIcon={canEdit && !isFromCardImport}
            copyValue={attendeesCopyValue}
            copyable={!!attendeesCopyValue}
        />
    );
}

function AttendeesRowSnapshot() {
    const {translate, localeCompare} = useLocalize();
    const personalDetailsList = usePersonalDetails();
    const transaction = useSnapshotTransactionField((tx: Transaction) => tx);
    const attendees = enrichAndSortAttendees(transaction?.comment?.attendees, personalDetailsList, localeCompare);

    if (!Array.isArray(attendees) || attendees.length === 0) {
        return null;
    }

    const title = getAttendeesListDisplayString(attendees);

    return (
        <FieldRow
            description={translate('iou.attendees')}
            title={title}
            numberOfLinesTitle={2}
            interactive={false}
            shouldShowRightIcon={false}
        />
    );
}

export {AttendeesRow, AttendeesRowSnapshot};
