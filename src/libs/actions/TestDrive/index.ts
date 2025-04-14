import {InteractionManager} from 'react-native';
import TestReceipt from '@assets/images/fake-test-drive-employee-receipt.jpg';
import {readFileAsync} from '@libs/fileDownload/FileUtils';
import Log from '@libs/Log';
import Navigation from '@libs/Navigation/Navigation';
import {getParticipantByLogin} from '@libs/OptionsListUtils';
import {generateReportID} from '@libs/ReportUtils';
import {initMoneyRequest, setMoneyRequestParticipants, setMoneyRequestReceipt} from '@userActions/IOU';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import type {SetTestDriveReceiptAndNavigate} from './types';

const setTestDriveReceiptAndNavigate: SetTestDriveReceiptAndNavigate = (email: string) => {
    try {
        const filename = `${CONST.TEST_DRIVE.EMPLOYEE_FAKE_RECEIPT.FILENAME}_${Date.now()}.png`;

        readFileAsync(
            TestReceipt as string,
            filename,
            (file) => {
                const reportID = generateReportID();
                initMoneyRequest(reportID, undefined, false, CONST.IOU.REQUEST_TYPE.SCAN, CONST.IOU.REQUEST_TYPE.SCAN);

                const source = URL.createObjectURL(file);
                setMoneyRequestReceipt(CONST.IOU.OPTIMISTIC_TRANSACTION_ID, source, filename, true, CONST.TEST_RECEIPT.FILE_TYPE, false);

                const participant = getParticipantByLogin(email);
                setMoneyRequestParticipants(CONST.IOU.OPTIMISTIC_TRANSACTION_ID, [
                    {
                        ...participant,
                        selected: true,
                    },
                ]);

                InteractionManager.runAfterInteractions(() => {
                    Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_CONFIRMATION.getRoute(CONST.IOU.ACTION.CREATE, CONST.IOU.TYPE.SUBMIT, CONST.IOU.OPTIMISTIC_TRANSACTION_ID, reportID));
                });
            },
            (error) => {
                Log.warn('Error reading test receipt:', {message: error});
            },
            CONST.TEST_DRIVE.EMPLOYEE_FAKE_RECEIPT.FILE_TYPE,
        );
    } catch (error) {
        Log.warn('Error in setTestDriveReceiptAndNavigate:', {message: error});
    }
};

// eslint-disable-next-line import/prefer-default-export
export {setTestDriveReceiptAndNavigate};
