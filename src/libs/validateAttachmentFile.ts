import CONST from '@src/CONST';
import type {FileObject} from '@src/types/utils/Attachment';

import type {ValueOf} from 'type-fest';

import {cleanFileName, hasHeicOrHeifExtension, isValidReceiptExtension, normalizeFileObject, validateImageForCorruption} from './fileDownload/FileUtils';

type ValidateAttachmentValidResult = {
    isValid: true;
    file: FileObject;
};

type ValidateAttachmentInvalidResult = {
    isValid: false;
    error: ValueOf<typeof CONST.FILE_VALIDATION_ERRORS>;
};

type ValidateAttachmentResult = ValidateAttachmentValidResult | ValidateAttachmentInvalidResult;

async function validateAttachmentFile(file: FileObject, item?: DataTransferItem, isValidatingReceipts = false): Promise<ValidateAttachmentResult> {
    if (!file.name || file.size == null) {
        return {isValid: false, error: CONST.FILE_VALIDATION_ERRORS.FILE_INVALID};
    }

    if (isValidatingReceipts && !isValidReceiptExtension(file)) {
        return {isValid: false, error: CONST.FILE_VALIDATION_ERRORS.WRONG_FILE_TYPE};
    }

    if (hasHeicOrHeifExtension(file)) {
        return {isValid: false, error: CONST.FILE_VALIDATION_ERRORS.HEIC_OR_HEIF_IMAGE};
    }

    const maxFileSize = isValidatingReceipts ? CONST.API_ATTACHMENT_VALIDATIONS.RECEIPT_MAX_SIZE : CONST.API_ATTACHMENT_VALIDATIONS.MAX_SIZE;
    if (file.size > maxFileSize) {
        return {isValid: false, error: CONST.FILE_VALIDATION_ERRORS.FILE_TOO_LARGE};
    }

    if (isValidatingReceipts && file.size < CONST.API_ATTACHMENT_VALIDATIONS.MIN_SIZE) {
        return {isValid: false, error: CONST.FILE_VALIDATION_ERRORS.FILE_TOO_SMALL};
    }

    let fileObject = file;
    const fileConverted = file.getAsFile?.();
    if (fileConverted) {
        fileObject = fileConverted;
    }

    if (!fileObject) {
        return {isValid: false, error: CONST.FILE_VALIDATION_ERRORS.FILE_INVALID};
    }

    if (isDataTransferItemDirectory(item)) {
        return {isValid: false, error: CONST.FILE_VALIDATION_ERRORS.FOLDER_NOT_ALLOWED};
    }

    const normalizedFile = await normalizeFileObject(fileObject);
    try {
        await validateImageForCorruption(normalizedFile);
    } catch (error) {
        return {isValid: false, error: CONST.FILE_VALIDATION_ERRORS.FILE_CORRUPTED};
    }

    if (normalizedFile instanceof File) {
        /**
         * Cleaning file name, done here so that it covers all cases:
         * upload, drag and drop, copy-paste
         */
        let updatedFile = normalizedFile;
        const cleanName = cleanFileName(updatedFile.name);
        // Snapshot the bytes into a memory-backed File: a picked File only references its OS file, so if
        // that file is modified or deleted before the queued request is persisted, the IndexedDB write
        // fails with "Failed to write blobs" and poisons the request queue. RN's File has no arrayBuffer.
        if (typeof updatedFile.arrayBuffer === 'function') {
            try {
                updatedFile = new File([await updatedFile.arrayBuffer()], cleanName, {type: updatedFile.type, lastModified: updatedFile.lastModified});
            } catch {
                // The backing file was already modified or deleted since it was picked.
                return {isValid: false, error: CONST.FILE_VALIDATION_ERRORS.FILE_INVALID};
            }
        } else if (updatedFile.name !== cleanName) {
            updatedFile = new File([updatedFile], cleanName, {type: updatedFile.type});
        }
        // Read the superseded URI from normalizedFile: updatedFile is always a fresh File that
        // doesn't carry the custom .uri property.
        const previousUri = normalizedFile.uri;
        const inputSource = URL.createObjectURL(updatedFile);
        if (previousUri && previousUri !== inputSource && previousUri.startsWith('blob:')) {
            // Release the superseded object URL (e.g. the one AttachmentPicker assigned) so its Blob can be
            // garbage-collected; orphaned blob: URLs keep the full-size file resident until the document dies.
            URL.revokeObjectURL(previousUri);
        }
        updatedFile.uri = inputSource;

        return {isValid: true, file: updatedFile};
    }

    return {isValid: true, file: normalizedFile};
}

function isDataTransferItemDirectory(item: DataTransferItem | undefined) {
    if (item?.kind === 'file' && 'webkitGetAsEntry' in item && item.webkitGetAsEntry()?.isDirectory) {
        return true;
    }

    return false;
}

export default validateAttachmentFile;
