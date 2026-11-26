/**
 * Add page: reopens the camera from Confirm details so a long receipt can be taken over several photos. Every photo
 * becomes another page of the same receipt. The new pages are saved only when the user finishes with the arrow
 * button, and Back throws them away.
 */
import FullPageNotFoundView from '@components/BlockingViews/FullPageNotFoundView';
import Header from '@components/Header';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';

import useDynamicBackPath from '@hooks/useDynamicBackPath';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useThemeStyles from '@hooks/useThemeStyles';

import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {MoneyRequestNavigatorParamList} from '@libs/Navigation/types';
import {getReceiptPages} from '@libs/ReceiptUtils';

import Camera from '@pages/iou/request/step/IOURequestStepScan/components/Camera';
import ReceiptPageCaptureContext from '@pages/iou/request/step/IOURequestStepScan/components/ReceiptPageCaptureContext';
import type {ReceiptPageCapture} from '@pages/iou/request/step/IOURequestStepScan/components/ReceiptPageCaptureContext';

import {discardReceiptPageFile, setDraftReceiptPages} from '@userActions/IOU/ReceiptPages';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import {DYNAMIC_ROUTES} from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import {transactionDraftReceiptSelector} from '@src/selectors/TransactionDraft';
import type {ReceiptPage} from '@src/types/onyx/Transaction';
import type {FileObject} from '@src/types/utils/Attachment';

import React, {useEffect, useRef, useState} from 'react';

type AddReceiptPageProps = PlatformStackScreenProps<MoneyRequestNavigatorParamList, typeof SCREENS.MONEY_REQUEST.DYNAMIC_ADD_RECEIPT_PAGE>;

function AddReceiptPage({route}: AddReceiptPageProps) {
    const {transactionID} = route.params;
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const backPath = useDynamicBackPath(DYNAMIC_ROUTES.MONEY_REQUEST_ADD_RECEIPT_PAGE.path);
    const [receipt] = useOnyx(`${ONYXKEYS.COLLECTION.TRANSACTION_DRAFT}${transactionID}`, {selector: transactionDraftReceiptSelector});
    const [newPages, setNewPages] = useState<ReceiptPage[]>([]);

    // The photos this session wrote that no receipt points at yet. Leaving the screen any way but the arrow button deletes them.
    const unsavedPages = useRef<ReceiptPage[]>([]);
    useEffect(
        () => () => {
            for (const page of unsavedPages.current) {
                discardReceiptPageFile(page);
            }
        },
        [],
    );

    const existingPages = getReceiptPages(receipt);
    const pages = [...existingPages, ...newPages];
    const cameraMode = receipt?.cameraMode;

    const addPage = (file: FileObject, source: string) => {
        const page: ReceiptPage = {source, filename: file.name ?? '', type: file.type ?? CONST.IMAGE_FILE_FORMAT.JPEG};
        // A second tap can land before the full strip re-renders and disables the shutter
        if (existingPages.length + unsavedPages.current.length >= CONST.RECEIPT.MAX_PAGES) {
            discardReceiptPageFile(page);
            return;
        }
        unsavedPages.current.push(page);
        setNewPages((previousPages) => [...previousPages, page]);
    };

    const goBack = () => {
        Navigation.goBack(backPath);
    };

    const savePages = () => {
        if (unsavedPages.current.length > 0) {
            setDraftReceiptPages(transactionID, [...existingPages, ...unsavedPages.current]);
            unsavedPages.current = [];
        }
        goBack();
    };

    const pageCapture: ReceiptPageCapture | undefined = cameraMode ? {pages, cameraMode, isFull: pages.length >= CONST.RECEIPT.MAX_PAGES} : undefined;

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom
            shouldEnableKeyboardAvoidingView={false}
            testID="AddReceiptPage"
        >
            <FullPageNotFoundView
                shouldShow={!pageCapture}
                onBackButtonPress={goBack}
            >
                <Header>
                    <Header.BackButton onPress={goBack} />
                    <Header.Title title={translate('receipt.addPage')} />
                </Header>
                <Text style={[styles.textSupporting, styles.ph5, styles.pb4]}>{translate('receipt.addPageHint')}</Text>
                <ReceiptPageCaptureContext.Provider value={pageCapture}>
                    <Camera
                        onCapture={addPage}
                        // The gallery is hidden while adding pages, because pages come from the camera only
                        onPicked={() => {}}
                        onMultiScanSubmit={savePages}
                        canUpgradeReceiptQuality={false}
                    />
                </ReceiptPageCaptureContext.Provider>
            </FullPageNotFoundView>
        </ScreenWrapper>
    );
}

AddReceiptPage.displayName = 'AddReceiptPage';

export default AddReceiptPage;
