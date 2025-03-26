import React from 'react';
import useLocalize from '@hooks/useLocalize';
import * as Welcome from '@userActions/Welcome';
import FeatureTrainingModal from './FeatureTrainingModal';

function TestDriveModal() {
    const {translate} = useLocalize();

    return (
        <FeatureTrainingModal
            title={translate('onboarding.testDriveModal.title')}
            description={translate('onboarding.testDriveModal.description')}
            confirmText={translate('footer.getStarted')}
            onClose={Welcome.completeHybridAppOnboarding}
        />
    );
}

TestDriveModal.displayName = 'TestDriveModal';
export default TestDriveModal;
