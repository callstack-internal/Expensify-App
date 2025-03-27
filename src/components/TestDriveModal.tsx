import React from 'react';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import FeatureTrainingModal from './FeatureTrainingModal';

function TestDriveModal() {
    const styles = useThemeStyles();
    const {translate} = useLocalize();

    return (
        <FeatureTrainingModal
            illustrationOuterContainerStyle={styles.p0}
            videoURL={CONST.WELCOME_VIDEO_URL}
            title={translate('onboarding.testDriveModal.title')}
            description={translate('onboarding.testDriveModal.description')}
            helpText={translate('common.skip')}
            confirmText={translate('onboarding.testDriveModal.confirmText')}
            onHelp={() => {}}
            onConfirm={() => {}}
        />
    );
}

TestDriveModal.displayName = 'TestDriveModal';
export default TestDriveModal;
