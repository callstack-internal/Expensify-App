import React, {useEffect, useState} from 'react';
import {useOnyx} from 'react-native-onyx';
import useDebouncedState from '@hooks/useDebouncedState';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {initMoneyRequest, setMoneyRequestParticipants} from '@libs/actions/IOU';
import {searchInServer} from '@libs/actions/Report';
import Navigation from '@libs/Navigation/Navigation';
import {getParticipantByLogin} from '@libs/OptionsListUtils';
import {generateReportID} from '@libs/ReportUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import FeatureTrainingModal from './FeatureTrainingModal';
import * as Illustrations from './Icon/Illustrations';
import TextInput from './TextInput';

function TestDriveModal() {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const [introSelected] = useOnyx(ONYXKEYS.NVP_INTRO_SELECTED);
    const [canStartTestDrive, setCanStartTestDrive] = useState(true);
    const [showEmailError, setShowEmailError] = useState(false);
    const [bossEmail, debouncedBossEmail, setBossEmail] = useDebouncedState('');

    // TODO: Create an util for this check
    const isEmployee = introSelected?.choice !== CONST.ONBOARDING_CHOICES.MANAGE_TEAM;

    // TODO: Write this better
    useEffect(() => {
        if (!introSelected) {
            return;
        }
        setCanStartTestDrive(!isEmployee);
    }, [introSelected, isEmployee]);

    useEffect(() => {
        // This updates the personal details list with the boss data
        searchInServer(debouncedBossEmail.trim());
    }, [debouncedBossEmail]);

    const closeModal = () => {
        Navigation.dismissModal();
    };

    const navigateTestDriveDemo = (canConfirm: boolean) => {
        if (!canConfirm) {
            setShowEmailError(true);
            return;
        }

        if (isEmployee) {
            const reportID = generateReportID();
            initMoneyRequest(reportID, undefined, false, CONST.IOU.REQUEST_TYPE.SCAN, CONST.IOU.REQUEST_TYPE.SCAN);

            // TODO: Set test receipt

            // TODO: Set boss as a participant

            const participant = getParticipantByLogin(bossEmail);

            setMoneyRequestParticipants(CONST.IOU.OPTIMISTIC_TRANSACTION_ID, [
                {
                    ...participant,
                    selected: true,
                },
            ]);

            Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_CONFIRMATION.getRoute(CONST.IOU.ACTION.CREATE, CONST.IOU.TYPE.SUBMIT, CONST.IOU.OPTIMISTIC_TRANSACTION_ID, reportID));
            return;
        }

        setTimeout(() => {
            Navigation.navigate(ROUTES.TEST_DRIVE_DEMO_ROOT);
        }, 1000);
    };

    return (
        <FeatureTrainingModal
            image={Illustrations.FastTrack}
            illustrationOuterContainerStyle={styles.p0}
            illustrationAspectRatio={500 / 300}
            title={translate('testDrive.modal.title')}
            description={translate('testDrive.modal.description')}
            helpText={translate('common.skip')}
            confirmText={translate('testDrive.modal.confirmText')}
            onHelp={closeModal}
            onConfirm={navigateTestDriveDemo}
            canConfirm={canStartTestDrive}
        >
            {isEmployee ? (
                <TextInput
                    // TODO: Create translations
                    placeholder="Enter your boss's email"
                    accessibilityLabel="Enter your boss's email"
                    value={bossEmail}
                    onChangeText={setBossEmail}
                    errorText={showEmailError ? 'Please enter a valid email' : undefined}
                />
            ) : null}
        </FeatureTrainingModal>
    );
}

TestDriveModal.displayName = 'TestDriveModal';
export default TestDriveModal;
