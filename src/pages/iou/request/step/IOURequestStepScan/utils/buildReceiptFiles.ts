import type {ReceiptCaptureSource} from '@libs/telemetry/ReceiptObservability';
import {logReceiptCaptured, mintAndStampReceiptTraceId} from '@libs/telemetry/ReceiptObservability';
import {shouldReuseInitialTransaction} from '@libs/TransactionUtils';

import type {ReceiptFile} from '@pages/iou/request/step/IOURequestStepScan/types';

import {setMoneyRequestReceipt} from '@userActions/IOU/Receipt';
import {setDraftReceiptCameraMode} from '@userActions/IOU/ReceiptPages';
import {buildOptimisticTransactionAndCreateDraft, removeDraftTransactionsByIDs} from '@userActions/TransactionEdit';

import type Transaction from '@src/types/onyx/Transaction';
import type {ReceiptCameraMode} from '@src/types/onyx/Transaction';
import type {FileObject} from '@src/types/utils/Attachment';

import type {OnyxEntry} from 'react-native-onyx';

type BuildReceiptFilesParams = {
    files: FileObject[];
    getFileSource: (file: FileObject) => string;
    initialTransaction: OnyxEntry<Transaction>;
    initialTransactionID: string;
    reportID: string;
    shouldAcceptMultipleFiles: boolean;
    isMultiScanEnabled: boolean;
    transactions: Transaction[];

    /**
     * IDs of stale draft transactions to wipe before building new ones.
     */
    draftTransactionIDsToCleanUp?: string[];

    /** How the receipt entered the app, recorded on the capture log. */
    captureSource?: ReceiptCaptureSource;

    /** The in-app camera mode the photo was taken in. Only a photo with one can get more pages later. */
    cameraMode?: ReceiptCameraMode;
};

/**
 * Builds ReceiptFile[] from captured/picked files, creating optimistic transaction drafts as needed
 * and storing receipts in Onyx via setMoneyRequestReceipt. When invoked with draftTransactionIDsToCleanUp,
 * wipes any stale drafts left from a previous scan batch first.
 */
function buildReceiptFiles({
    files,
    getFileSource,
    initialTransaction,
    initialTransactionID,
    reportID,
    shouldAcceptMultipleFiles,
    isMultiScanEnabled,
    transactions,
    draftTransactionIDsToCleanUp,
    captureSource = 'file',
    cameraMode,
}: BuildReceiptFilesParams): ReceiptFile[] {
    if (files.length === 0) {
        return [];
    }

    if (!isMultiScanEnabled && draftTransactionIDsToCleanUp && draftTransactionIDsToCleanUp.length > 0) {
        removeDraftTransactionsByIDs(draftTransactionIDsToCleanUp, true);
    }

    const receiptFiles: ReceiptFile[] = [];

    for (const [index, file] of files.entries()) {
        const source = getFileSource(file);
        const transaction = shouldReuseInitialTransaction(initialTransaction, shouldAcceptMultipleFiles, index, isMultiScanEnabled, transactions)
            ? initialTransaction
            : buildOptimisticTransactionAndCreateDraft({
                  initialTransaction: initialTransaction as Partial<Transaction>,
                  reportID,
              });

        const transactionID = transaction?.transactionID ?? initialTransactionID;
        const receiptTraceId = mintAndStampReceiptTraceId(file);
        logReceiptCaptured({file, captureSource, receiptTraceId});
        receiptFiles.push({file, source, transactionID});
        setMoneyRequestReceipt(transactionID, source, file.name ?? '', true, file.type, false, false, undefined, receiptTraceId);
        if (cameraMode) {
            setDraftReceiptCameraMode(transactionID, cameraMode);
        }
    }

    return receiptFiles;
}

export default buildReceiptFiles;
