import {Str} from 'expensify-common';
import React, {useCallback, useRef, useState} from 'react';
import {InteractionManager} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import useLocalize from '@hooks/useLocalize';
import useSearchTermAndSearch from '@hooks/useSearchTermAndSearch';
import useThemeStyles from '@hooks/useThemeStyles';
import {setTestDriveReceiptAndNavigate} from '@libs/actions/TestDrive';
import Navigation from '@libs/Navigation/Navigation';
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
                setTestDriveReceiptAndNavigate(bossEmail);
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
