import {setMoneyRequestReceipt} from '@libs/actions/IOU/Receipt';
import {deleteDraftReceiptPage, replaceDraftReceiptPage, setDraftReceiptCameraMode, setDraftReceiptPages} from '@libs/actions/IOU/ReceiptPages';
import ReceiptStorage from '@libs/ReceiptStorage';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReceiptPage} from '@src/types/onyx/Transaction';

import Onyx from 'react-native-onyx';

import getOnyxValue from '../../utils/getOnyxValue';
import waitForBatchedUpdates from '../../utils/waitForBatchedUpdates';

const TRANSACTION_ID = '1';
const DRAFT_KEY = `${ONYXKEYS.COLLECTION.TRANSACTION_DRAFT}${TRANSACTION_ID}` as const;

const makePage = (name: string): ReceiptPage => ({source: `file:///receipts/${name}.jpg`, filename: `${name}.jpg`, type: 'image/jpeg'});
const FIRST_PAGE = makePage('first');
const SECOND_PAGE = makePage('second');
const THIRD_PAGE = makePage('third');

describe('actions/IOU/ReceiptPages', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(() => {
        jest.restoreAllMocks();
        return Onyx.clear().then(waitForBatchedUpdates);
    });

    it('keeps the first page as the receipt source when a receipt has several pages', async () => {
        // Given a draft expense whose receipt is one camera photo
        await Onyx.set(DRAFT_KEY, {transactionID: TRANSACTION_ID, receipt: {source: FIRST_PAGE.source, filename: FIRST_PAGE.filename, type: FIRST_PAGE.type}});

        // When two more pages are saved for it
        setDraftReceiptPages(TRANSACTION_ID, [FIRST_PAGE, SECOND_PAGE, THIRD_PAGE]);
        await waitForBatchedUpdates();

        // Then the receipt lists every page in order, and screens that show one photo still show page 1
        const draft = await getOnyxValue(DRAFT_KEY);
        expect(draft?.receipt?.pages).toEqual([FIRST_PAGE, SECOND_PAGE, THIRD_PAGE]);
        expect(draft?.receipt?.source).toBe(FIRST_PAGE.source);
        expect(draft?.receipt?.filename).toBe(FIRST_PAGE.filename);
    });

    it('turns a receipt back into a one-photo receipt when only one page is left', async () => {
        // Given a draft receipt with two pages
        await Onyx.set(DRAFT_KEY, {transactionID: TRANSACTION_ID});
        setDraftReceiptPages(TRANSACTION_ID, [FIRST_PAGE, SECOND_PAGE]);
        await waitForBatchedUpdates();
        jest.spyOn(ReceiptStorage, 'resolve').mockImplementation((source) => (typeof source === 'string' ? source : undefined));
        const discardSpy = jest.spyOn(ReceiptStorage, 'discard').mockResolvedValue();

        // When the first page is deleted
        deleteDraftReceiptPage(TRANSACTION_ID, [FIRST_PAGE, SECOND_PAGE], 0);
        await waitForBatchedUpdates();

        // Then the second page becomes the whole receipt, so it looks and behaves like a single photo, and the deleted photo is removed from disk
        const draft = await getOnyxValue(DRAFT_KEY);
        expect(draft?.receipt?.pages).toBeUndefined();
        expect(draft?.receipt?.source).toBe(SECOND_PAGE.source);
        expect(draft?.receipt?.filename).toBe(SECOND_PAGE.filename);
        expect(discardSpy).toHaveBeenCalledWith(FIRST_PAGE.source);
    });

    it('does not delete the only page of a receipt', async () => {
        // Given a draft receipt with one page
        await Onyx.set(DRAFT_KEY, {transactionID: TRANSACTION_ID, receipt: {source: FIRST_PAGE.source, filename: FIRST_PAGE.filename}});
        const discardSpy = jest.spyOn(ReceiptStorage, 'discard').mockResolvedValue();

        // When something asks to delete that page
        deleteDraftReceiptPage(TRANSACTION_ID, [FIRST_PAGE], 0);
        await waitForBatchedUpdates();

        // Then the receipt is kept, because removing a whole receipt is what Delete receipt is for
        const draft = await getOnyxValue(DRAFT_KEY);
        expect(draft?.receipt?.source).toBe(FIRST_PAGE.source);
        expect(discardSpy).not.toHaveBeenCalled();
    });

    it('swaps only the edited page when a page is rotated or cropped', async () => {
        // Given a draft receipt with three pages
        await Onyx.set(DRAFT_KEY, {transactionID: TRANSACTION_ID});
        setDraftReceiptPages(TRANSACTION_ID, [FIRST_PAGE, SECOND_PAGE, THIRD_PAGE]);
        await waitForBatchedUpdates();
        const rotatedPage = makePage('second-rotated');

        // When the second page is replaced by its rotated photo
        replaceDraftReceiptPage(TRANSACTION_ID, [FIRST_PAGE, SECOND_PAGE, THIRD_PAGE], 1, rotatedPage);
        await waitForBatchedUpdates();

        // Then the other pages keep their place and the receipt source stays on page 1
        const draft = await getOnyxValue(DRAFT_KEY);
        expect(draft?.receipt?.pages).toEqual([FIRST_PAGE, rotatedPage, THIRD_PAGE]);
        expect(draft?.receipt?.source).toBe(FIRST_PAGE.source);
    });

    it('drops the pages and camera mode when the receipt is replaced', async () => {
        // Given a draft receipt taken over two pages in the in-app camera
        await Onyx.set(DRAFT_KEY, {transactionID: TRANSACTION_ID});
        setDraftReceiptPages(TRANSACTION_ID, [FIRST_PAGE, SECOND_PAGE]);
        setDraftReceiptCameraMode(TRANSACTION_ID, CONST.RECEIPT.CAMERA_MODE.MANUAL);
        await waitForBatchedUpdates();

        // When the user replaces it with a file
        setMoneyRequestReceipt(TRANSACTION_ID, 'file:///receipts/replacement.pdf', 'replacement.pdf', true, 'application/pdf');
        await waitForBatchedUpdates();

        // Then the new receipt does not inherit the old pages, and can't get more pages since it didn't come from the camera
        const draft = await getOnyxValue(DRAFT_KEY);
        expect(draft?.receipt?.source).toBe('file:///receipts/replacement.pdf');
        expect(draft?.receipt?.pages).toBeUndefined();
        expect(draft?.receipt?.cameraMode).toBeUndefined();
    });
});
