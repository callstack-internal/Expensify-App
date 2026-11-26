import type {ReceiptCameraMode, ReceiptPage} from '@src/types/onyx/Transaction';

import {createContext, useContext} from 'react';

/** What the camera needs while it takes more pages of one receipt instead of new receipts. */
type ReceiptPageCapture = {
    /** Every page of the receipt so far, the ones it had and the ones taken in this session */
    pages: ReceiptPage[];

    /** The camera mode the receipt was taken in, which its other pages keep */
    cameraMode: ReceiptCameraMode;

    /** Whether the receipt has as many pages as it can take */
    isFull: boolean;
};

const ReceiptPageCaptureContext = createContext<ReceiptPageCapture | undefined>(undefined);

/** Returns the page capture session the camera is in, or undefined when each photo is its own receipt. */
function useReceiptPageCapture(): ReceiptPageCapture | undefined {
    return useContext(ReceiptPageCaptureContext);
}

export default ReceiptPageCaptureContext;
export {useReceiptPageCapture};
export type {ReceiptPageCapture};
