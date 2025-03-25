import React, {useCallback, useState} from 'react';
import Modal from '@components/Modal';
import TestDriveBanner from './TestDriveBanner';
import TestDriveRenderer from './TestDriveRenderer';

function TestDrive() {
    const [isVisible, setIsVisible] = useState(true);

    const finishTestDrive = useCallback(() => {
        setIsVisible(false);
    }, []);

    return (
        <Modal
            isVisible={isVisible}
            fullscreen
            onClose={() => {}}
            style={{backgroundColor: 'white'}}
            innerContainerStyle={{flex: 1}}
        >
            <TestDriveBanner onPress={finishTestDrive} />
            <TestDriveRenderer />
        </Modal>
    );
}

TestDrive.displayName = 'TestDrive';

export default TestDrive;
