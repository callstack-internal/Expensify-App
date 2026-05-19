import React from 'react';
import useActiveRoute from '@hooks/useActiveRoute';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useLocalize from '@hooks/useLocalize';
import {getTransactionDetails} from '@libs/ReportUtils';
import {getFormattedCreated, isFromCreditCardImport as isCardTransactionTransactionUtils} from '@libs/TransactionUtils';
import Navigation from '@navigation/Navigation';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import type {Transaction} from '@src/types/onyx';
import {useLiveTransactionField} from '../contexts/LiveTransactionProvider';
import {useSnapshotTransactionField} from '../contexts/SnapshotTransactionProvider';
import {useFieldEditPermission, useTransactionThreadReport} from '../contexts/ThreadProvider';
import {useFieldViolationMessages} from '../contexts/ViolationsProvider';
import FieldRow from '../FieldRow';

function DateRow() {
    const {translate} = useLocalize();
    const {getReportRHPActiveRoute} = useActiveRoute();
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();

    const transaction = useLiveTransactionField((tx: Transaction) => tx);
    const canEdit = useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.DATE);
    const transactionThreadReport = useTransactionThreadReport();
    const violationMessages = useFieldViolationMessages('date');

    const details = getTransactionDetails(transaction, undefined, undefined, false, false, currentUserPersonalDetails);
    const transactionDate = details?.created;
    const transactionPostedDate = details?.postedDate;
    const isFromCardImport = isCardTransactionTransactionUtils(transaction);

    let dateDescription = `${translate('common.date')}`;
    if (isFromCardImport && transactionPostedDate) {
        dateDescription += ` ${CONST.DOT_SEPARATOR} ${translate('iou.posted')} ${transactionPostedDate}`;
    }

    const violationsError = violationMessages.length > 0 ? `${violationMessages.map((v) => v.name).join('. ')}.` : '';
    const brickRoadIndicator = violationsError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined;
    const copyValue = !canEdit ? transactionDate : undefined;

    function onPress() {
        if (!transaction?.transactionID || !transactionThreadReport?.reportID) {
            return;
        }
        Navigation.navigate(
            ROUTES.MONEY_REQUEST_STEP_DATE.getRoute(CONST.IOU.ACTION.EDIT, CONST.IOU.TYPE.SUBMIT, transaction.transactionID, transactionThreadReport.reportID, getReportRHPActiveRoute()),
        );
    }

    return (
        <FieldRow
            pendingAction={transaction?.pendingFields?.created}
            description={dateDescription}
            title={transactionDate}
            numberOfLinesTitle={2}
            interactive={canEdit}
            shouldShowRightIcon={canEdit}
            onPress={onPress}
            brickRoadIndicator={brickRoadIndicator}
            errorText={violationsError}
            copyValue={copyValue}
            copyable={!!copyValue}
        />
    );
}

function DateRowSnapshot() {
    const {translate} = useLocalize();
    const transaction = useSnapshotTransactionField((tx: Transaction) => tx);
    const transactionDate = getFormattedCreated(transaction);

    return (
        <FieldRow
            description={translate('common.date')}
            title={transactionDate}
            numberOfLinesTitle={2}
            interactive={false}
            shouldShowRightIcon={false}
        />
    );
}

export {DateRow, DateRowSnapshot};
