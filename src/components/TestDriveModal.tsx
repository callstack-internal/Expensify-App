import React from 'react';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import FeatureTrainingModal from './FeatureTrainingModal';
import * as Illustrations from './Icon/Illustrations';

function TestDriveModal() {
    const styles = useThemeStyles();
    const {translate} = useLocalize();

    const closeModal = () => {
        Navigation.dismissModal();
    };

    const navigateTestDriveDemo = () => {
        setTimeout(() => {
            Navigation.navigate(ROUTES.TEST_DRIVE_DEMO_ROOT);
        }, 1000);
    };

    return (
        <FeatureTrainingModal
            image={Illustrations.FastTrack}
            illustrationOuterContainerStyle={styles.p0}
            illustrationAspectRatio={500 / 300}
            title={translate('onboarding.testDriveModal.title')}
            description={translate('onboarding.testDriveModal.description')}
            helpText={translate('common.skip')}
            confirmText={translate('onboarding.testDriveModal.confirmText')}
            onHelp={closeModal}
            onConfirm={navigateTestDriveDemo}
        />
    );
}

TestDriveModal.displayName = 'TestDriveModal';
export default TestDriveModal;
