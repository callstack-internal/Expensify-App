import validateAttachmentFile from '@libs/validateAttachmentFile';

import type {FileObject} from '@src/types/utils/Attachment';

import CONST from '../../src/CONST';
import * as FileUtils from '../../src/libs/fileDownload/FileUtils';

// Jest resolves the .native variant of platform-split modules; force the web implementation
// since the OS-file snapshot behavior under test is web-only.
jest.mock('@src/libs/snapshotPickedFile', () => jest.requireActual<{default: (file: File, name: string) => Promise<File>}>('@src/libs/snapshotPickedFile/index.ts'));

// Mock only normalizeFileObject and validateImageForCorruption; keep the rest real
jest.mock('@src/libs/fileDownload/FileUtils', () => {
    const actual = jest.requireActual<typeof FileUtils>('@src/libs/fileDownload/FileUtils');
    return {
        ...actual,
        normalizeFileObject: jest.fn(),
        validateImageForCorruption: jest.fn(),
    };
});

const mockFileUtils = jest.mocked(FileUtils);

describe('validateAttachmentFile OS-backed file snapshot (web)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFileUtils.normalizeFileObject.mockImplementation(async (file) => file);
        mockFileUtils.validateImageForCorruption.mockResolvedValue(undefined);
    });

    it('snapshots the picked file bytes into a new memory-backed File', async () => {
        const createObjectURLSpy = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:new-url');
        try {
            const file: FileObject = new File([new Blob(['content'], {type: 'text/plain'})], 'image.png', {type: 'image/png'});
            // The RN File polyfill in Jest has no arrayBuffer; emulate the web File API.
            const arrayBufferSpy = jest.fn().mockResolvedValue(new ArrayBuffer(7));
            Object.defineProperty(file, 'arrayBuffer', {value: arrayBufferSpy, configurable: true});

            const result = await validateAttachmentFile(file);

            expect(result.isValid).toBe(true);
            if (!result.isValid) {
                throw new Error('validateAttachmentFile should return a valid result');
            }
            expect(arrayBufferSpy).toHaveBeenCalled();
            // The returned File must be a fresh memory-backed copy, not the OS-backed original.
            expect(result.file).not.toBe(file);
        } finally {
            createObjectURLSpy.mockRestore();
        }
    });

    it('returns FILE_INVALID when the picked file can no longer be read (deleted or modified on disk)', async () => {
        const file: FileObject = new File([new Blob(['content'], {type: 'text/plain'})], 'image.png', {type: 'image/png'});
        // Chromium rejects the read when the backing OS file changed since it was picked.
        const arrayBufferSpy = jest.fn().mockRejectedValue(new DOMException('The requested file could not be read', 'NotReadableError'));
        Object.defineProperty(file, 'arrayBuffer', {value: arrayBufferSpy, configurable: true});

        const result = await validateAttachmentFile(file);

        expect(result.isValid).toBe(false);
        if (result.isValid) {
            throw new Error('validateAttachmentFile should return an invalid result');
        }
        expect(result.error).toBe(CONST.FILE_VALIDATION_ERRORS.FILE_INVALID);
    });
});
