import {Image, InteractionManager} from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import TestReceipt from '@assets/images/fake-test-drive-employee-receipt.jpg';
import type {FileObject} from '@components/AttachmentModal';
import Log from '@libs/Log';
import Navigation from '@libs/Navigation/Navigation';
import {getParticipantByLogin} from '@libs/OptionsListUtils';
import {generateReportID} from '@libs/ReportUtils';
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

const setTestDriveReceiptAndNavigate: SetTestDriveReceiptAndNavigate = (email: string) => {
    try {
        const filename = `${CONST.TEST_DRIVE.EMPLOYEE_FAKE_RECEIPT.FILENAME}_${Date.now()}.png`;
        const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;
        const source = Image.resolveAssetSource(TestReceipt).uri;

        ReactNativeBlobUtil.config({
            fileCache: true,
            appendExt: 'png',
            path,
        })
            .fetch('GET', source)
            .then(() => {
                const file: FileObject = {
                    uri: `file://${path}`,
                    name: filename,
                    type: CONST.TEST_DRIVE.EMPLOYEE_FAKE_RECEIPT.FILE_TYPE,
                    size: 0,
                };

                if (!file.uri) {
                    Log.warn('Error reading test receipt');
                    return;
                }

                const transactionID = CONST.IOU.OPTIMISTIC_TRANSACTION_ID;
                const reportID = generateReportID();
                initMoneyRequest(reportID, undefined, false, CONST.IOU.REQUEST_TYPE.SCAN, CONST.IOU.REQUEST_TYPE.SCAN);

                setMoneyRequestReceipt(transactionID, file.uri, filename, true, file.type, false, true);

                const participant = getParticipantByLogin(email);
                setMoneyRequestParticipants(transactionID, [
                    {
                        ...participant,
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
            })
            .catch((error) => {
                Log.warn('Error reading test receipt:', {message: error});
            });
    } catch (error) {
        Log.warn('Error in setTestDriveReceiptAndNavigate:', {message: error});
    }
};

// eslint-disable-next-line import/prefer-default-export
export {setTestDriveReceiptAndNavigate};
