import React from 'react';
import MenuItem from '@components/MenuItem';
import {useLiveTransactionField} from '@components/MoneyRequestView/contexts/LiveTransactionProvider';
import {useSnapshotTransactionField} from '@components/MoneyRequestView/contexts/SnapshotTransactionProvider';
import {useParentReportID, useTransactionThreadReport} from '@components/MoneyRequestView/contexts/ThreadProvider';
import useActiveRoute from '@hooks/useActiveRoute';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import {getTripIDFromTransactionParentReportID} from '@libs/ReportUtils';
import {hasReservationList} from '@libs/TransactionUtils';
import Navigation from '@navigation/Navigation';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Transaction} from '@src/types/onyx';

function ViewTripDetailsRow() {
    const {translate} = useLocalize();
    const {getReportRHPActiveRoute} = useActiveRoute();
    const icons = useMemoizedLazyExpensifyIcons(['Suitcase']);

    const transaction = useLiveTransactionField((tx: Transaction) => tx);
    const transactionThreadReport = useTransactionThreadReport();
    const parentReportID = useParentReportID();
    const [parentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${parentReportID}`);

    const tripID = getTripIDFromTransactionParentReportID(parentReport?.parentReportID);
    const shouldShow = hasReservationList(transaction) && !!tripID;
    if (!shouldShow) {
        return null;
    }

    function onPress() {
        const reservations = transaction?.receipt?.reservationList?.length ?? 0;
        if (reservations > 1) {
            Navigation.navigate(ROUTES.TRAVEL_TRIP_SUMMARY.getRoute(transactionThreadReport?.reportID, transaction?.transactionID, getReportRHPActiveRoute()));
            return;
        }
        Navigation.navigate(ROUTES.TRAVEL_TRIP_DETAILS.getRoute(transactionThreadReport?.reportID, transaction?.transactionID, '0', 0, getReportRHPActiveRoute()));
    }

    return (
        <MenuItem
            title={translate('travel.viewTripDetails')}
            icon={icons.Suitcase}
            onPress={onPress}
        />
    );
}

function ViewTripDetailsRowSnapshot() {
    const {translate} = useLocalize();
    const icons = useMemoizedLazyExpensifyIcons(['Suitcase']);
    const transaction = useSnapshotTransactionField((tx: Transaction) => tx);

    if (!hasReservationList(transaction)) {
        return null;
    }

    return (
        <MenuItem
            title={translate('travel.viewTripDetails')}
            icon={icons.Suitcase}
            interactive={false}
        />
    );
}

export {ViewTripDetailsRow, ViewTripDetailsRowSnapshot};
