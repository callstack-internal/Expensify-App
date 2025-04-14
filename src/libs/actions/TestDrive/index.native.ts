import {Image, InteractionManager} from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import TestReceipt from '@assets/images/fake-test-drive-employee-receipt.jpg';
import type {FileObject} from '@components/AttachmentModal';
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

                const reportID = generateReportID();
                initMoneyRequest(reportID, undefined, false, CONST.IOU.REQUEST_TYPE.SCAN, CONST.IOU.REQUEST_TYPE.SCAN);

                setMoneyRequestReceipt(CONST.IOU.OPTIMISTIC_TRANSACTION_ID, file.uri, filename, true, file.type, false);

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
