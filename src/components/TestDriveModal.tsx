import React from 'react';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import FeatureTrainingModal from './FeatureTrainingModal';
import * as Illustrations from './Icon/Illustrations';

function TestDriveModal() {
    const styles = useThemeStyles();
    const {translate} = useLocalize();

    return (
        <FeatureTrainingModal
            image={Illustrations.FastTrack}
            illustrationOuterContainerStyle={styles.p0}
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
