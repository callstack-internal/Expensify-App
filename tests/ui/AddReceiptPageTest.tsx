import {act, render, screen} from '@testing-library/react-native';

import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {MoneyRequestNavigatorParamList} from '@libs/Navigation/types';

import AddReceiptPage from '@pages/iou/request/step/IOURequestStepScan/AddReceiptPage';
import type * as ReceiptPageCaptureContextModule from '@pages/iou/request/step/IOURequestStepScan/components/ReceiptPageCaptureContext';
import type {ReceiptPageCapture} from '@pages/iou/request/step/IOURequestStepScan/components/ReceiptPageCaptureContext';

import type * as ReceiptPagesModule from '@userActions/IOU/ReceiptPages';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';
import type {ReceiptCameraMode, ReceiptPage} from '@src/types/onyx/Transaction';
import type {FileObject} from '@src/types/utils/Attachment';

import type {PropsWithChildren} from 'react';
import type {View as RNView} from 'react-native';

import React from 'react';
import Onyx from 'react-native-onyx';

import getOnyxValue from '../utils/getOnyxValue';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

type MockCameraProps = {
    onCapture: (file: FileObject, source: string) => void;
    onMultiScanSubmit?: () => void;
};

let mockCameraProps: MockCameraProps | undefined;
let mockPageCapture: ReceiptPageCapture | undefined;
let mockPressBack: (() => void) | undefined;
const mockGoBack = jest.fn<void, unknown[]>();
const mockDiscardReceiptPageFile = jest.fn<void, [ReceiptPage]>();

jest.mock('@pages/iou/request/step/IOURequestStepScan/components/Camera', () => {
    const {default: PageCaptureContext} = jest.requireActual<typeof ReceiptPageCaptureContextModule>('@pages/iou/request/step/IOURequestStepScan/components/ReceiptPageCaptureContext');
    return {
        __esModule: true,
        default: (props: MockCameraProps) => {
            mockCameraProps = props;
            return (
                <PageCaptureContext.Consumer>
                    {(pageCapture) => {
                        mockPageCapture = pageCapture;
                        return null;
                    }}
                </PageCaptureContext.Consumer>
            );
        },
    };
});

jest.mock('@userActions/IOU/ReceiptPages', () => ({
    ...jest.requireActual<typeof ReceiptPagesModule>('@userActions/IOU/ReceiptPages'),
    discardReceiptPageFile: (page: ReceiptPage) => mockDiscardReceiptPageFile(page),
}));

jest.mock('@libs/Navigation/Navigation', () => ({
    __esModule: true,
    default: {goBack: (...args: unknown[]) => mockGoBack(...args)},
}));

jest.mock('@hooks/useDynamicBackPath', () => ({__esModule: true, default: () => 'confirmation'}));
jest.mock('@hooks/useLocalize', () => ({__esModule: true, default: () => ({translate: (key: string) => key})}));
jest.mock('@hooks/useThemeStyles', () => ({__esModule: true, default: () => new Proxy({}, {get: () => ({})})}));
jest.mock('@components/ScreenWrapper', () => ({__esModule: true, default: ({children}: PropsWithChildren) => children}));
jest.mock('@components/Text', () => ({__esModule: true, default: () => null}));
jest.mock('@components/BlockingViews/FullPageNotFoundView', () => {
    const {View} = jest.requireActual<{View: typeof RNView}>('react-native');
    return {
        __esModule: true,
        default: ({shouldShow, children}: PropsWithChildren<{shouldShow: boolean}>) => (shouldShow ? <View testID="not-found" /> : children),
    };
});
jest.mock('@components/Header', () => {
    const Header = ({children}: PropsWithChildren) => children;
    Header.BackButton = ({onPress}: {onPress: () => void}) => {
        mockPressBack = onPress;
        return null;
    };
    Header.Title = () => null;
    return {__esModule: true, default: Header};
});

const TRANSACTION_ID = '1';
const DRAFT_KEY = `${ONYXKEYS.COLLECTION.TRANSACTION_DRAFT}${TRANSACTION_ID}` as const;

const makePage = (name: string): ReceiptPage => ({source: `file:///receipts/${name}.jpg`, filename: `${name}.jpg`, type: CONST.IMAGE_FILE_FORMAT.JPEG});
const FIRST_PAGE = makePage('first');

type AddReceiptPageProps = PlatformStackScreenProps<MoneyRequestNavigatorParamList, typeof SCREENS.MONEY_REQUEST.DYNAMIC_ADD_RECEIPT_PAGE>;

function renderAddReceiptPage() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the screen only reads the transaction ID from its route
    const props = {route: {params: {transactionID: TRANSACTION_ID}}} as unknown as AddReceiptPageProps;
    // eslint-disable-next-line react/jsx-props-no-spreading
    return render(<AddReceiptPage {...props} />);
}

function capturePage(page: ReceiptPage) {
    act(() => {
        mockCameraProps?.onCapture({name: page.filename, type: page.type}, page.source);
    });
}

async function setDraftReceipt(pages: ReceiptPage[], cameraMode?: ReceiptCameraMode) {
    const firstPage = pages.at(0);
    await Onyx.set(DRAFT_KEY, {
        transactionID: TRANSACTION_ID,
        receipt: {source: firstPage?.source, filename: firstPage?.filename, type: firstPage?.type, pages: pages.length > 1 ? pages : undefined, cameraMode},
    });
}

describe('AddReceiptPage', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        mockCameraProps = undefined;
        mockPageCapture = undefined;
        mockPressBack = undefined;
        jest.clearAllMocks();
        await Onyx.clear();
    });

    it('adds the new photos after the existing pages when the user taps the arrow', async () => {
        // Given a draft receipt of one photo taken in the in-app camera
        await setDraftReceipt([FIRST_PAGE], CONST.RECEIPT.CAMERA_MODE.MANUAL);
        const view = renderAddReceiptPage();
        await waitForBatchedUpdatesWithAct();

        // When the user takes two more photos and taps the arrow
        const secondPage = makePage('second');
        const thirdPage = makePage('third');
        capturePage(secondPage);
        capturePage(thirdPage);
        act(() => {
            mockCameraProps?.onMultiScanSubmit?.();
        });
        await waitForBatchedUpdatesWithAct();
        view.unmount();

        // Then the receipt has all three pages in order, the user goes back to Confirm details, and no saved photo is deleted
        const draft = await getOnyxValue(DRAFT_KEY);
        expect(draft?.receipt?.pages).toEqual([FIRST_PAGE, secondPage, thirdPage]);
        expect(draft?.receipt?.source).toBe(FIRST_PAGE.source);
        expect(mockGoBack).toHaveBeenCalledWith('confirmation');
        expect(mockDiscardReceiptPageFile).not.toHaveBeenCalled();
    });

    it('throws away the new photos when the user goes back', async () => {
        // Given a draft receipt of one photo taken in the in-app camera
        await setDraftReceipt([FIRST_PAGE], CONST.RECEIPT.CAMERA_MODE.MANUAL);
        const view = renderAddReceiptPage();
        await waitForBatchedUpdatesWithAct();

        // When the user takes a photo and then leaves with Back
        const secondPage = makePage('second');
        capturePage(secondPage);
        act(() => {
            mockPressBack?.();
        });
        view.unmount();
        await waitForBatchedUpdatesWithAct();

        // Then the receipt keeps only its first photo, and the new photo is deleted since nothing points at it
        const draft = await getOnyxValue(DRAFT_KEY);
        expect(draft?.receipt?.pages).toBeUndefined();
        expect(draft?.receipt?.source).toBe(FIRST_PAGE.source);
        expect(mockGoBack).toHaveBeenCalledWith('confirmation');
        expect(mockDiscardReceiptPageFile).toHaveBeenCalledTimes(1);
        expect(mockDiscardReceiptPageFile).toHaveBeenCalledWith(secondPage);
    });

    it(`stops at ${CONST.RECEIPT.MAX_PAGES} pages`, async () => {
        // Given a draft receipt that has one page less than the limit
        const pages = Array.from({length: CONST.RECEIPT.MAX_PAGES - 1}, (_, index) => makePage(`page-${index}`));
        await setDraftReceipt(pages, CONST.RECEIPT.CAMERA_MODE.MANUAL);
        renderAddReceiptPage();
        await waitForBatchedUpdatesWithAct();
        expect(mockPageCapture?.isFull).toBe(false);

        // When the user takes two photos before the camera turns off, e.g. with a fast second tap
        const lastPage = makePage('last');
        const extraPage = makePage('extra');
        capturePage(lastPage);
        capturePage(extraPage);
        act(() => {
            mockCameraProps?.onMultiScanSubmit?.();
        });
        await waitForBatchedUpdatesWithAct();

        // Then only the photo that fits is kept, the camera is told the receipt is full, and the extra photo is deleted
        const draft = await getOnyxValue(DRAFT_KEY);
        expect(draft?.receipt?.pages).toEqual([...pages, lastPage]);
        expect(mockPageCapture?.isFull).toBe(true);
        expect(mockDiscardReceiptPageFile).toHaveBeenCalledWith(extraPage);
    });

    it('takes the new pages in the same camera mode as the first one', async () => {
        // Given a draft receipt whose first photo was taken with receipt enhancements on
        await setDraftReceipt([FIRST_PAGE], CONST.RECEIPT.CAMERA_MODE.ENHANCEMENT);

        // When the Add page screen opens
        renderAddReceiptPage();
        await waitForBatchedUpdatesWithAct();

        // Then the camera takes pages for this receipt in the same mode, which also hides the gallery and the mode switch
        expect(mockPageCapture).toEqual({pages: [FIRST_PAGE], cameraMode: CONST.RECEIPT.CAMERA_MODE.ENHANCEMENT, isFull: false});
        expect(screen.queryByTestId('not-found')).toBeNull();
    });

    it('shows not found for a receipt that did not come from the in-app camera', async () => {
        // Given a draft receipt picked from the gallery, which has no camera mode
        await setDraftReceipt([FIRST_PAGE]);

        // When the Add page screen opens, e.g. from an old link
        renderAddReceiptPage();
        await waitForBatchedUpdatesWithAct();

        // Then there is nothing to add pages to, so the camera is not shown
        expect(screen.getByTestId('not-found')).toBeTruthy();
        expect(mockCameraProps).toBeUndefined();
    });
});
