import React from 'react';
import useActiveRoute from '@hooks/useActiveRoute';
import useLocalize from '@hooks/useLocalize';
import Parser from '@libs/Parser';
import {getDescription, isScanning} from '@libs/TransactionUtils';
import Navigation from '@navigation/Navigation';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import type {Transaction} from '@src/types/onyx';
import {useLiveTransactionField} from '../contexts/LiveTransactionProvider';
import {useSnapshotTransactionField} from '../contexts/SnapshotTransactionProvider';
import {useFieldEditPermission, useTransactionThreadReport} from '../contexts/ThreadProvider';
import {useFieldViolationMessages} from '../contexts/ViolationsProvider';
import FieldRow from '../FieldRow';

function DescriptionRow() {
    const {translate} = useLocalize();
    const {getReportRHPActiveRoute} = useActiveRoute();

    const transaction = useLiveTransactionField((tx: Transaction) => tx);
    const canEdit = useFieldEditPermission(CONST.EDIT_REQUEST_FIELD.DESCRIPTION);
    const transactionThreadReport = useTransactionThreadReport();
    const violationMessages = useFieldViolationMessages('comment');

    const descriptionHTML = getDescription(transaction);
    const isTransactionScanning = isScanning(transaction);
    const interactive = canEdit && !isTransactionScanning;
    const descriptionCopyValue = !interactive && descriptionHTML ? Parser.htmlToText(descriptionHTML) : undefined;

    const violationsError = violationMessages.length > 0 ? `${violationMessages.map((v) => v.name).join('. ')}.` : '';
    const brickRoadIndicator = violationsError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined;

    function onPress() {
        if (!transaction?.transactionID || !transactionThreadReport?.reportID) {
            return;
        }
        Navigation.navigate(
            ROUTES.MONEY_REQUEST_STEP_DESCRIPTION.getRoute(
                CONST.IOU.ACTION.EDIT,
                CONST.IOU.TYPE.SUBMIT,
                transaction.transactionID,
                transactionThreadReport.reportID,
                getReportRHPActiveRoute(),
            ),
        );
    }

    return (
        <FieldRow
            pendingAction={transaction?.pendingFields?.comment}
            description={translate('common.description')}
            shouldRenderAsHTML
            title={descriptionHTML}
            interactive={interactive}
            shouldShowRightIcon={interactive}
            onPress={onPress}
            brickRoadIndicator={brickRoadIndicator}
            errorText={violationsError}
            numberOfLinesTitle={0}
            copyValue={descriptionCopyValue}
            copyable={!!descriptionCopyValue}
        />
    );
}

function DescriptionRowSnapshot() {
    const {translate} = useLocalize();
    const descriptionHTML = useSnapshotTransactionField((tx: Transaction) => getDescription(tx));

    if (!descriptionHTML) {
        return null;
    }

    return (
        <FieldRow
            description={translate('common.description')}
            shouldRenderAsHTML
            title={descriptionHTML}
            interactive={false}
            shouldShowRightIcon={false}
            numberOfLinesTitle={0}
        />
    );
}

export {DescriptionRow, DescriptionRowSnapshot};
