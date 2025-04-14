import {Str} from 'expensify-common';
import React, {useCallback, useRef, useState} from 'react';
import {InteractionManager} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import TestReceipt from '@assets/images/fake-receipt.png';
import useLocalize from '@hooks/useLocalize';
import useSearchTermAndSearch from '@hooks/useSearchTermAndSearch';
import useThemeStyles from '@hooks/useThemeStyles';
import {initMoneyRequest, setMoneyRequestParticipants, setMoneyRequestReceipt} from '@libs/actions/IOU';
import {readFileAsync} from '@libs/fileDownload/FileUtils';
import Navigation from '@libs/Navigation/Navigation';
import {getParticipantByLogin} from '@libs/OptionsListUtils';
import {generateReportID} from '@libs/ReportUtils';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import FeatureTrainingModal from './FeatureTrainingModal';
import * as Illustrations from './Icon/Illustrations';
import Text from './Text';
import TextInput from './TextInput';

function TestDriveModal() {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const [introSelected] = useOnyx(ONYXKEYS.NVP_INTRO_SELECTED);
    const [bossEmail, setBossEmail] = useState('');
    const [formError, setFormError] = useState<TranslationPaths | undefined>();
    const actionToPerformRef = useRef<'dismiss' | 'navigate_demo' | 'navigate_iou'>('dismiss');
    const setBossEmailAndSearch = useSearchTermAndSearch(setBossEmail, false);

    const isAdmin = introSelected?.choice === CONST.ONBOARDING_CHOICES.MANAGE_TEAM;
    const modalDescription: string | React.ReactNode = isAdmin ? (
        translate('testDrive.modal.description')
    ) : (
        <>
            {translate('testDrive.modal.employee.description1')}
            <Text style={styles.textBold}>{translate('testDrive.modal.employee.description2')}</Text>
            {translate('testDrive.modal.employee.description3')}
        </>
    );

    const validate = useCallback(
        (value: string) => {
            const loginTrim = value.trim();

            if (!loginTrim || !Str.isValidEmail(loginTrim)) {
                setFormError('common.error.email');
                return false;
            }

            setFormError(undefined);
            return true;
        },
        [setFormError],
    );

    const dismiss = (closeModal: () => void) => {
        actionToPerformRef.current = 'dismiss';
        closeModal();
    };

    const confirm = (closeModal: () => void) => {
        if (isAdmin) {
            actionToPerformRef.current = 'navigate_demo';
            closeModal();
            return;
        }

        if (!isAdmin) {
            if (!validate(bossEmail)) {
                return;
            }

            actionToPerformRef.current = 'navigate_iou';
            closeModal();
        }
    };

    const navigate = () => {
        switch (actionToPerformRef.current) {
            case 'navigate_demo': {
                InteractionManager.runAfterInteractions(() => {
                    Navigation.navigate(ROUTES.TEST_DRIVE_DEMO_ROOT);
                });
                break;
            }
            case 'navigate_iou': {
                try {
                    const filename = `${CONST.TEST_RECEIPT.FILENAME}_${Date.now()}.png`;

                    readFileAsync(
                        TestReceipt as string,
                        filename,
                        (file) => {
                            const reportID = generateReportID();
                            initMoneyRequest(reportID, undefined, false, CONST.IOU.REQUEST_TYPE.SCAN, CONST.IOU.REQUEST_TYPE.SCAN);

                            const source = URL.createObjectURL(file);
                            setMoneyRequestReceipt(CONST.IOU.OPTIMISTIC_TRANSACTION_ID, source, filename, true, CONST.TEST_RECEIPT.FILE_TYPE, false);

                            const participant = getParticipantByLogin(bossEmail);
                            setMoneyRequestParticipants(CONST.IOU.OPTIMISTIC_TRANSACTION_ID, [
                                {
                                    ...participant,
                                    selected: true,
                                },
                            ]);

                            InteractionManager.runAfterInteractions(() => {
                                Navigation.navigate(
                                    ROUTES.MONEY_REQUEST_STEP_CONFIRMATION.getRoute(CONST.IOU.ACTION.CREATE, CONST.IOU.TYPE.SUBMIT, CONST.IOU.OPTIMISTIC_TRANSACTION_ID, reportID),
                                );
                            });
                        },
                        (error) => {
                            console.error('Error reading test receipt:', error);
                        },
                        CONST.TEST_RECEIPT.FILE_TYPE,
                    );
                } catch (error) {
                    console.error('Error in navigate:', error);
                }
                break;
            }
            default: {
                // do nothing
            }
        }
    };

    return (
        <FeatureTrainingModal
            image={Illustrations.FastTrack}
            illustrationOuterContainerStyle={styles.p0}
            illustrationAspectRatio={500 / 300}
            title={translate('testDrive.modal.title')}
            description={modalDescription}
            helpText={translate('common.skip')}
            confirmText={translate('testDrive.modal.confirmText')}
            onHelp={dismiss}
            onConfirm={confirm}
            onClose={navigate}
            shouldCloseOnConfirm={false}
        >
            {!isAdmin ? (
                <TextInput
                    placeholder={translate('testDrive.modal.employee.email')}
                    accessibilityLabel={translate('testDrive.modal.employee.email')}
                    value={bossEmail}
                    onChangeText={setBossEmailAndSearch}
                    errorText={formError ? translate(formError) : undefined}
                />
            ) : null}
        </FeatureTrainingModal>
    );
}

TestDriveModal.displayName = 'TestDriveModal';
export default TestDriveModal;
