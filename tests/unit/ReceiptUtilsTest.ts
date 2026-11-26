import {canAddReceiptPage, constructReceiptSourceFromFilename, getReceiptPages, getThumbnailAndImageURIs, shouldValidateFile} from '@libs/ReceiptUtils';

import CONST from '@src/CONST';
import type {Transaction} from '@src/types/onyx';
import type {Receipt} from '@src/types/onyx/Transaction';

import createRandomTransaction from '../utils/collections/transaction';

const makeTransaction = (receipt: Receipt | undefined, overrides: Partial<Transaction> = {}): Transaction => ({
    ...createRandomTransaction(1),
    hasEReceipt: false,
    receipt,
    ...overrides,
});

describe('ReceiptUtils', () => {
    describe('getThumbnailAndImageURIs', () => {
        it('returns isEmptyReceipt for a genuinely empty receipt (no state, source, filename, or eReceipt)', () => {
            expect(getThumbnailAndImageURIs(makeTransaction({}))).toEqual({isEmptyReceipt: true});
        });

        it('returns isEmptyReceipt when there is no receipt at all', () => {
            expect(getThumbnailAndImageURIs(makeTransaction(undefined))).toEqual({isEmptyReceipt: true});
        });

        it('builds image/thumbnail URLs from source when receipt has a source but no state', () => {
            const source = 'https://www.expensify.com/receipts/w_abc123.jpg';
            const result = getThumbnailAndImageURIs(makeTransaction({source, filename: 'w_abc123.jpg'}));

            expect(result.isEmptyReceipt).toBeUndefined();
            expect(result.image).toBe(source);
            expect(result.thumbnail320).toBe(`${source}.320.jpg`);
            expect(result.thumbnail).toBe(`${source}.1024.jpg`);
        });

        it('builds URLs from filename when receipt has only a filename (e.g. email/billing receipts) and no state or source', () => {
            const filename = 'w_abc123.jpg';
            const expectedSource = constructReceiptSourceFromFilename(filename);
            const result = getThumbnailAndImageURIs(makeTransaction({filename}));

            expect(result.isEmptyReceipt).toBeUndefined();
            expect(result.image).toBe(expectedSource);
            expect(result.thumbnail320).toBe(`${expectedSource}.320.jpg`);
            expect(result.filename).toBe(filename);
        });

        it('still resolves a receipt that has a state (SmartScanned)', () => {
            const source = 'https://www.expensify.com/receipts/w_scanned.jpg';
            const result = getThumbnailAndImageURIs(makeTransaction({source, state: CONST.IOU.RECEIPT_STATE.OPEN}));

            expect(result.isEmptyReceipt).toBeUndefined();
            expect(result.image).toBe(source);
        });
    });

    describe('shouldValidateFile', () => {
        it('validates a shared HEIF file so it is converted to JPEG like HEIC', () => {
            // Given a file shared as image/heif, which Android sends for .heif files
            const file = {id: 'photo.heif', content: 'file:///photo.heif', mimeType: CONST.SHARE_FILE_MIMETYPE.HEIF};

            // When checking whether the share flow should validate it
            const result = shouldValidateFile(file);

            // Then it is validated, so the HEIF is converted before upload instead of being sent as is
            expect(result).toBe(true);
        });

        it('does not validate a shared JPEG file', () => {
            // Given a file shared as image/jpeg, which needs no conversion
            const file = {id: 'photo.jpg', content: 'file:///photo.jpg', mimeType: CONST.SHARE_FILE_MIMETYPE.JPEG};

            // When checking whether the share flow should validate it
            const result = shouldValidateFile(file);

            // Then it is not validated, so the JPEG is used as is
            expect(result).toBe(false);
        });
    });
});

describe('getReceiptPages', () => {
    it('treats a one-photo receipt as its only page', () => {
        // Given a receipt with a single photo and no page list
        const receipt: Receipt = {source: 'file:///receipts/a.jpg', filename: 'a.jpg', type: 'image/jpeg'};

        // When its pages are read
        const pages = getReceiptPages(receipt);

        // Then the photo is page 1, so the viewer and badge can treat every receipt the same way
        expect(pages).toEqual([{source: 'file:///receipts/a.jpg', filename: 'a.jpg', type: 'image/jpeg'}]);
    });

    it('returns no pages for a receipt without a path', () => {
        // Given a receipt that has no file yet
        const receipt: Receipt = {};

        // When its pages are read
        const pages = getReceiptPages(receipt);

        // Then there is nothing to page through
        expect(pages).toEqual([]);
    });
});

describe('canAddReceiptPage', () => {
    const cameraReceipt: Receipt = {source: 'file:///receipts/a.jpg', filename: 'a.jpg', cameraMode: CONST.RECEIPT.CAMERA_MODE.MANUAL};

    it('allows more pages for a single in-app camera photo', () => {
        // Given the only receipt in the flow, taken in the in-app camera
        // When the confirmation page asks whether it can get another page
        // Then it can
        expect(canAddReceiptPage(cameraReceipt, 1)).toBe(true);
    });

    it('does not allow more pages for a file picked from the gallery', () => {
        // Given a receipt picked from files, which has no camera mode
        const pickedReceipt: Receipt = {source: 'file:///receipts/a.jpg', filename: 'a.jpg'};

        // When the confirmation page asks whether it can get another page
        // Then it can't, because pages come from the camera only
        expect(canAddReceiptPage(pickedReceipt, 1)).toBe(false);
    });

    it('does not allow more pages after a rapid fire session with several receipts', () => {
        // Given two receipts taken in rapid fire, where each photo is its own expense
        // When the confirmation page asks whether one of them can get another page
        // Then it can't, so photos keep becoming separate expenses
        expect(canAddReceiptPage(cameraReceipt, 2)).toBe(false);
    });

    it('stops at the page limit', () => {
        // Given a receipt that already has the most pages a receipt can have
        const pages = Array.from({length: CONST.RECEIPT.MAX_PAGES}, (_, index) => ({source: `file:///receipts/${index}.jpg`, filename: `${index}.jpg`, type: 'image/jpeg'}));

        // When the confirmation page asks whether it can get another page
        // Then it can't, so the Add page button is hidden
        expect(canAddReceiptPage({...cameraReceipt, pages}, 1)).toBe(false);
    });
});
