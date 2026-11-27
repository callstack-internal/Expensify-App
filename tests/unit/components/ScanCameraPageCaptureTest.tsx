import {render} from '@testing-library/react-native';

import Camera from '@pages/iou/request/step/IOURequestStepScan/components/Camera/index.native';
import ReceiptPageCaptureContext from '@pages/iou/request/step/IOURequestStepScan/components/ReceiptPageCaptureContext';
import type {ReceiptPageCapture} from '@pages/iou/request/step/IOURequestStepScan/components/ReceiptPageCaptureContext';

import CONST from '@src/CONST';

import type {ReactNode} from 'react';

import React from 'react';

type ControlsBarProps = {
    isMultiScanEnabled: boolean;
    isShutterDisabled?: boolean;
    setFlash?: unknown;
    toggleReceiptEnhancement?: unknown;
};

let mockControlsBarProps: ControlsBarProps | undefined;
let mockPreviewsSubmit: (() => void) | undefined;

jest.mock('@hooks/useNativeCamera', () => ({
    __esModule: true,
    default: () => ({
        camera: {current: {}},
        device: {id: 'back', hasFlash: true},
        cameraPermissionStatus: 'granted',
        flash: false,
        setFlash: jest.fn(),
        hasFlash: true,
        didCapturePhoto: false,
        setDidCapturePhoto: jest.fn(),
        isAttachmentPickerActive: false,
        setIsAttachmentPickerActive: jest.fn(),
        isPlatformMuted: false,
        askForPermissions: jest.fn(),
        tapGesture: {},
        cameraFocusIndicatorAnimatedStyle: {},
    }),
}));

jest.mock('@hooks/usePermissions', () => ({__esModule: true, default: () => ({isBetaEnabled: () => true})}));

jest.mock('@pages/iou/request/step/IOURequestStepScan/documentDetection/isDocumentDetectionSupported', () => ({__esModule: true, default: () => true}));
jest.mock('@pages/iou/request/step/IOURequestStepScan/documentDetection/DocumentDetection', () => ({
    __esModule: true,
    default: ({children}: {children: (edges: null) => ReactNode}) => children(null),
}));
jest.mock('@pages/iou/request/step/IOURequestStepScan/documentDetection/DocumentOutline', () => () => null);
jest.mock('@pages/iou/request/step/IOURequestStepScan/documentDetection/ReceiptEnhancementToast', () => () => null);

jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual<Record<string, unknown>>('@react-navigation/native'),
    useNavigation: () => ({isFocused: () => true}),
    useFocusEffect: () => {},
}));

jest.mock('@pages/iou/request/step/IOURequestStepScan/components/ScannerControlsBar', () => ({
    __esModule: true,
    default: (props: ControlsBarProps) => {
        mockControlsBarProps = props;
        return null;
    },
}));

jest.mock('@pages/iou/request/step/IOURequestStepScan/components/ReceiptPreviews', () => ({
    __esModule: true,
    default: ({submit}: {submit: () => void}) => {
        mockPreviewsSubmit = submit;
        return null;
    },
}));

jest.mock('@pages/iou/request/step/IOURequestStepScan/components/CameraViewport', () => () => null);
jest.mock('@pages/iou/request/step/IOURequestStepScan/components/CameraPermissionPrompt', () => () => null);

jest.mock('@pages/iou/request/step/IOURequestStepScan/components/MultiScanContext', () => ({
    useMultiScanState: () => ({isMultiScanEnabled: false, canUseMultiScan: false}),
    useMultiScanActions: () => ({toggleMultiScan: jest.fn()}),
}));

jest.mock('@pages/iou/request/step/IOURequestStepScan/hooks/usePhotoUpgrade', () => ({
    __esModule: true,
    default: () => ({hasPendingPhotoCapture: false, startPhotoCapture: jest.fn(), upgradeReceiptWithPhoto: jest.fn(), discardPendingPhoto: jest.fn()}),
}));

jest.mock('@pages/iou/request/step/IOURequestStepScan/utils/startReceiptPrepareSpan', () => ({__esModule: true, default: jest.fn()}));
jest.mock('@pages/iou/request/step/IOURequestStepScan/hooks/useCameraInitTelemetry', () => ({
    __esModule: true,
    default: () => ({handleCameraConfigured: jest.fn(), handleSessionConfigSelected: jest.fn()}),
}));
jest.mock('@hooks/useReceiptPhotoOutput', () => ({__esModule: true, default: () => ({photoOutput: {}, cameraAspectRatio: undefined, updatePhotoResolution: jest.fn()})}));
jest.mock('@hooks/useLocalize', () => ({__esModule: true, default: () => ({translate: (key: string) => key})}));
jest.mock('@hooks/useIsInLandscapeMode', () => ({__esModule: true, default: () => false}));
jest.mock('@hooks/useWindowDimensions', () => ({__esModule: true, default: () => ({windowWidth: 390, windowHeight: 844})}));
jest.mock('@libs/getReceiptsUploadFolderPath', () => ({__esModule: true, default: () => '/receipts'}));
jest.mock('@libs/HapticFeedback', () => ({__esModule: true, default: {press: jest.fn()}}));
jest.mock('@libs/telemetry/activeSpans', () => ({
    cancelSpan: jest.fn(),
    endSpanWithAttributes: jest.fn(),
    getSpan: jest.fn(),
    startSpan: jest.fn(),
}));
jest.mock('@libs/Log', () => ({__esModule: true, default: {info: jest.fn(), warn: jest.fn(), hmmm: jest.fn(), alert: jest.fn()}}));

const FIRST_PAGE = {source: 'file:///receipts/first.jpg', filename: 'first.jpg', type: CONST.IMAGE_FILE_FORMAT.JPEG};

function renderCamera(pageCapture?: ReceiptPageCapture, onMultiScanSubmit?: () => void) {
    render(
        <ReceiptPageCaptureContext.Provider value={pageCapture}>
            <Camera
                onCapture={jest.fn()}
                onPicked={jest.fn()}
                onMultiScanSubmit={onMultiScanSubmit}
            />
        </ReceiptPageCaptureContext.Provider>,
    );
}

describe('Scan camera while adding pages to a receipt', () => {
    beforeEach(() => {
        mockControlsBarProps = undefined;
        mockPreviewsSubmit = undefined;
    });

    it('shows the gallery and the camera controls when each photo is its own receipt', () => {
        // Given the normal scan camera, with receipt enhancements available
        // When it opens outside of Add page
        renderCamera();

        // Then the gallery button is shown and the user can switch flash and receipt enhancements
        expect(mockControlsBarProps?.isMultiScanEnabled).toBe(false);
        expect(mockControlsBarProps?.setFlash).toBeDefined();
        expect(mockControlsBarProps?.toggleReceiptEnhancement).toBeDefined();
    });

    it('hides the gallery and the mode switch, and shows the page strip', () => {
        // Given the camera opened from Add page, for a receipt that has one page
        const onMultiScanSubmit = jest.fn();

        // When it renders, even though rapid fire is not available
        renderCamera({pages: [FIRST_PAGE], cameraMode: CONST.RECEIPT.CAMERA_MODE.MANUAL, isFull: false}, onMultiScanSubmit);

        // Then pages come from the camera only, every page keeps the first page's mode, and the strip's arrow saves the pages
        expect(mockControlsBarProps?.isMultiScanEnabled).toBe(true);
        expect(mockControlsBarProps?.toggleReceiptEnhancement).toBeUndefined();
        expect(mockControlsBarProps?.setFlash).toBeUndefined();
        expect(mockControlsBarProps?.isShutterDisabled).toBe(false);
        expect(mockPreviewsSubmit).toBe(onMultiScanSubmit);
    });

    it('turns off the shutter once the receipt has as many pages as it can take', () => {
        // Given a receipt that already has the most pages allowed
        const pages = Array.from({length: CONST.RECEIPT.MAX_PAGES}, () => FIRST_PAGE);

        // When the camera opens from Add page
        renderCamera({pages, cameraMode: CONST.RECEIPT.CAMERA_MODE.MANUAL, isFull: true}, jest.fn());

        // Then the shutter can't take another photo
        expect(mockControlsBarProps?.isShutterDisabled).toBe(true);
    });
});
