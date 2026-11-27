/**
 * Edits the photos of a draft receipt taken over several pages. The first page always doubles as the receipt's
 * `source`, so every screen that shows one photo keeps showing page 1.
 */
import {getErrorMessage} from '@libs/ErrorUtils';
import Log from '@libs/Log';
import ReceiptStorage from '@libs/ReceiptStorage';

import ONYXKEYS from '@src/ONYXKEYS';
import type {ReceiptCameraMode, ReceiptPage} from '@src/types/onyx/Transaction';

import Onyx from 'react-native-onyx';

/** Remembers the camera mode a draft receipt was just taken in, so its next pages are taken the same way. */
function setDraftReceiptCameraMode(transactionID: string, cameraMode: ReceiptCameraMode) {
    Onyx.merge(`${ONYXKEYS.COLLECTION.TRANSACTION_DRAFT}${transactionID}`, {
        receipt: {cameraMode},
    });
}

/** Saves the photos of a draft receipt in page order. A single page is stored as a plain one-photo receipt. */
function setDraftReceiptPages(transactionID: string, pages: ReceiptPage[]): Promise<void> {
    const firstPage = pages.at(0);
    if (!firstPage) {
        return Promise.resolve();
    }
    for (const page of pages) {
        ReceiptStorage.retain(page.source);
    }
    return Onyx.merge(`${ONYXKEYS.COLLECTION.TRANSACTION_DRAFT}${transactionID}`, {
        receipt: {
            source: firstPage.source,
            filename: firstPage.filename,
            type: firstPage.type,
            pages: pages.length > 1 ? pages : null,
            pageCount: null,
        },
    });
}

/** Deletes a photo that is no longer part of any receipt. */
function discardReceiptPageFile(page: ReceiptPage) {
    const path = ReceiptStorage.resolve(page.source);
    if (!path) {
        return;
    }
    ReceiptStorage.discard(path).catch((error: unknown) => {
        Log.info('[ReceiptPages] could not delete a discarded receipt page', false, {error: getErrorMessage(error)});
    });
}

/** Removes one page from a draft receipt and keeps the rest in order. The last page can't be removed this way. */
function deleteDraftReceiptPage(transactionID: string, pages: ReceiptPage[], pageIndex: number) {
    const deletedPage = pages.at(pageIndex);
    if (!deletedPage || pages.length < 2) {
        return;
    }
    setDraftReceiptPages(
        transactionID,
        pages.filter((_, index) => index !== pageIndex),
    );
    discardReceiptPageFile(deletedPage);
}

/** Swaps one page of a draft receipt for an edited photo, e.g. after it was rotated or cropped. */
function replaceDraftReceiptPage(transactionID: string, pages: ReceiptPage[], pageIndex: number, page: ReceiptPage) {
    const replacedPage = pages.at(pageIndex);
    if (!replacedPage) {
        return;
    }
    setDraftReceiptPages(
        transactionID,
        pages.map((existingPage, index) => (index === pageIndex ? page : existingPage)),
    )
        .then(() => {
            // Delete the old photo only once the draft points at the new one, so the viewer never shows a missing file
            if (replacedPage.source === page.source) {
                return;
            }
            discardReceiptPageFile(replacedPage);
        })
        .catch((error: unknown) => {
            Log.info('[ReceiptPages] could not save an edited receipt page', false, {error: getErrorMessage(error)});
        });
}

export {deleteDraftReceiptPage, discardReceiptPageFile, replaceDraftReceiptPage, setDraftReceiptCameraMode, setDraftReceiptPages};
