import {render, screen} from '@testing-library/react-native';

import ReceiptPageCaptureContext from '@pages/iou/request/step/IOURequestStepScan/components/ReceiptPageCaptureContext';
import type {ReceiptPageCapture} from '@pages/iou/request/step/IOURequestStepScan/components/ReceiptPageCaptureContext';
import ReceiptPreviews from '@pages/iou/request/step/IOURequestStepScan/components/ReceiptPreviews';

import CONST from '@src/CONST';
import type {ReceiptPage} from '@src/types/onyx/Transaction';

import React from 'react';

let mockThumbnailUri: string | undefined = 'file:///thumbnails/page.jpg';

jest.mock('@hooks/useLocalize', () => ({
    __esModule: true,
    default: () => ({
        translate: (key: string, params?: {page: number; pageCount: number}) => (key === 'receipt.pageCount' && params ? `Page ${params.page} of ${params.pageCount}` : key),
    }),
}));
jest.mock('@hooks/useLocalReceiptThumbnail', () => ({__esModule: true, default: () => ({thumbnailUri: mockThumbnailUri})}));
jest.mock('@hooks/useTransactionDraftReceipts', () => ({__esModule: true, default: () => []}));
jest.mock('@pages/iou/request/step/IOURequestStepScan/hooks/useReceiptPreviewsSizes', () => ({
    __esModule: true,
    default: () => ({previewsSize: 100, previewItemSize: 60, initialReceiptsAmount: 5}),
}));
jest.mock('@components/Image', () => ({__esModule: true, default: () => null}));

const makePage = (name: string): ReceiptPage => ({source: `file:///receipts/${name}.jpg`, filename: `${name}.jpg`, type: CONST.IMAGE_FILE_FORMAT.JPEG});
const PAGES = [makePage('first'), makePage('second'), makePage('third')];

function renderStrip(pageCapture: ReceiptPageCapture | undefined) {
    render(
        <ReceiptPageCaptureContext.Provider value={pageCapture}>
            <ReceiptPreviews
                submit={jest.fn()}
                isMultiScanEnabled
            />
        </ReceiptPageCaptureContext.Provider>,
    );
}

describe('ReceiptPreviews page labels', () => {
    beforeEach(() => {
        mockThumbnailUri = 'file:///thumbnails/page.jpg';
    });

    it('reads out each page of the receipt by its place', () => {
        // Given the strip on Add page for a receipt with three pages
        // When it renders
        renderStrip({pages: PAGES, cameraMode: CONST.RECEIPT.CAMERA_MODE.MANUAL, isFull: false});

        // Then a screen reader hears where each page sits in the receipt, and the empty slots stay silent
        expect(screen.getByLabelText('Page 1 of 3')).toBeTruthy();
        expect(screen.getByLabelText('Page 2 of 3')).toBeTruthy();
        expect(screen.getByLabelText('Page 3 of 3')).toBeTruthy();
        expect(screen.queryByLabelText('Page 4 of 3')).toBeNull();
    });

    it('reads out a page while its thumbnail is still loading', () => {
        // Given the strip on Add page before the page thumbnails are ready
        mockThumbnailUri = undefined;

        // When it renders
        renderStrip({pages: PAGES.slice(0, 2), cameraMode: CONST.RECEIPT.CAMERA_MODE.MANUAL, isFull: false});

        // Then the placeholder for each page already says which page it is
        expect(screen.getByLabelText('Page 1 of 2')).toBeTruthy();
        expect(screen.getByLabelText('Page 2 of 2')).toBeTruthy();
    });

    it('does not label the strip as pages in rapid fire', () => {
        // Given the strip in rapid fire, where each photo is its own expense
        // When it renders
        renderStrip(undefined);

        // Then nothing is read out as a page
        expect(screen.queryByLabelText(/^Page /)).toBeNull();
    });
});
