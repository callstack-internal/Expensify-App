import useFilesValidation from '@hooks/useFilesValidation';
import type {FileObject} from '@src/types/utils/Attachment';

/**
 * Wraps useFilesValidation for scan-specific file capture.
 * Validates files (type, size, HEIC conversion, PDF thumbnails) and calls
 * the provided callback with the validated files.
 */
function useScanCapture(onFilesValidated: (files: FileObject[], dataTransferItems: DataTransferItem[]) => void) {
    const {validateFiles, PDFValidationComponent, ErrorModal} = useFilesValidation(onFilesValidated);

    return {
        validateFiles,
        PDFValidationComponent,
        ErrorModal,
    };
}

export default useScanCapture;
