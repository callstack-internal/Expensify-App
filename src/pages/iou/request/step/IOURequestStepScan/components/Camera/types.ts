import type {ReceiptCameraMode} from '@src/types/onyx/Transaction';
import type {FileObject} from '@src/types/utils/Attachment';

type CameraProps = {
    /**
     * Called when a file is captured or selected, with the file object and its source URI. The native camera also
     * passes the mode the photo was taken in, which lets the receipt get more pages later.
     */
    onCapture: (file: FileObject, source: string, cameraMode?: ReceiptCameraMode) => void;

    /** Whether the gallery/file picker should accept multiple files at once */
    shouldAcceptMultipleFiles?: boolean;

    /** Called when the camera view finishes layout */
    onLayout?: () => void;

    /**
     * Called when files are selected from the gallery picker (native), the file picker (web),
     * or dropped onto the upload zone (desktop web). Files must be validated by the consumer
     * before being treated as receipts; the camera shutter path stays on `onCapture`.
     */
    onPicked: (files: FileObject[], items?: DataTransferItem[]) => void;

    /** Whether we are replacing an existing receipt (affects drop zone icon/title on desktop) */
    isReplacingReceipt?: boolean;

    /** Called when the attachment picker opens or closes (useful for showing/hiding a full-screen loader) */
    onAttachmentPickerStatusChange?: (isOpen: boolean) => void;

    /** Called when the user taps the submit button on the preview ribbon, in multi-scan or while adding receipt pages. Used by native and mobile web. */
    onMultiScanSubmit?: () => void;

    /** Whether the shutter may take a full-resolution photo to upgrade the fast snapshot. Defaults to true; off for replace-receipt and multi-scan. */
    canUpgradeReceiptQuality?: boolean;
};

// Consumers import the named type, so a default export would only be dead code that knip reports.
// eslint-disable-next-line import/prefer-default-export
export type {CameraProps};
