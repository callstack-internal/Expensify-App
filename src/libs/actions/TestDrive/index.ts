import {InteractionManager} from 'react-native';
import TestReceipt from '@assets/images/fake-test-drive-employee-receipt.jpg';
import {readFileAsync} from '@libs/fileDownload/FileUtils';
import Log from '@libs/Log';
import Navigation from '@libs/Navigation/Navigation';
import {generateReportID} from '@libs/ReportUtils';
import {generateAccountID} from '@libs/UserUtils';
import {
    initMoneyRequest,
    setMoneyRequestAmount,
    setMoneyRequestCreated,
    setMoneyRequestDescription,
    setMoneyRequestMerchant,
    setMoneyRequestParticipants,
    setMoneyRequestReceipt,
} from '@userActions/IOU';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import type {SetTestDriveReceiptAndNavigate} from './types';

// TODO: Most of the logic between the platform files are the same and maybe could be on EmployeeTestDriveModal.tsx.
// Check if we can move to there.
const setTestDriveReceiptAndNavigate: SetTestDriveReceiptAndNavigate = (email: string) => {
    try {
        const filename = `${CONST.TEST_DRIVE.EMPLOYEE_FAKE_RECEIPT.FILENAME}_${Date.now()}.png`;

        readFileAsync(
            TestReceipt as string,
            filename,
            (file) => {
                const transactionID = CONST.IOU.OPTIMISTIC_TRANSACTION_ID;
                const reportID = generateReportID();
                initMoneyRequest(reportID, undefined, false, CONST.IOU.REQUEST_TYPE.SCAN, CONST.IOU.REQUEST_TYPE.SCAN);

                const source = URL.createObjectURL(file);
                setMoneyRequestReceipt(transactionID, source, filename, true, CONST.TEST_RECEIPT.FILE_TYPE, false, true);

                setMoneyRequestParticipants(transactionID, [
                    {
                        accountID: generateAccountID(email),
                        login: email,
                        displayName: email,
                        selected: true,
                    },
                ]);

                setMoneyRequestAmount(transactionID, CONST.TEST_DRIVE.EMPLOYEE_FAKE_RECEIPT.AMOUNT, CONST.TEST_DRIVE.EMPLOYEE_FAKE_RECEIPT.CURRENCY);
                setMoneyRequestDescription(transactionID, CONST.TEST_DRIVE.EMPLOYEE_FAKE_RECEIPT.DESCRIPTION, true);
                setMoneyRequestMerchant(transactionID, CONST.TEST_DRIVE.EMPLOYEE_FAKE_RECEIPT.MERCHANT, true);
                setMoneyRequestCreated(transactionID, CONST.TEST_DRIVE.EMPLOYEE_FAKE_RECEIPT.CREATED, true);

                InteractionManager.runAfterInteractions(() => {
                    Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_CONFIRMATION.getRoute(CONST.IOU.ACTION.CREATE, CONST.IOU.TYPE.SUBMIT, transactionID, reportID));
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
