import React from 'react';
import FeatureTrainingModal from '@components/FeatureTrainingModal';
import * as Illustrations from '@components/Icon/Illustrations';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import type ChildrenProps from '@src/types/utils/ChildrenProps';

type BaseTestDriveModalProps = Partial<ChildrenProps> & {
    description: string | React.ReactNode;
    onHelp: (closeModal: () => void) => void;
    onConfirm: (closeModal: () => void) => void;
    onClose: (() => void) | undefined;
};

function BaseTestDriveModal({description, onHelp, onConfirm, onClose, children}: BaseTestDriveModalProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();

    return (
        <FeatureTrainingModal
            image={Illustrations.FastTrack}
            illustrationOuterContainerStyle={styles.p0}
            illustrationAspectRatio={500 / 300}
            title={translate('testDrive.modal.title')}
            description={description}
            helpText={translate('common.skip')}
            confirmText={translate('testDrive.modal.confirmText')}
            onHelp={onHelp}
            onConfirm={onConfirm}
            onClose={onClose}
            shouldCloseOnConfirm={false}
        >
            {children}
        </FeatureTrainingModal>
    );
}

BaseTestDriveModal.displayName = 'BaseTestDriveModal';

export default BaseTestDriveModal;
