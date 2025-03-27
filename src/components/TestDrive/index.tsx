import React, {useCallback, useState} from 'react';
import Modal from '@components/Modal';
import SafeAreaConsumer from '@components/SafeAreaConsumer';
import TestDriveBanner from './TestDriveBanner';
import TestDriveRenderer from './TestDriveRenderer';

function TestDrive() {
    const [isVisible, setIsVisible] = useState(true);

    const finishTestDrive = useCallback(() => {
        setIsVisible(false);
    }, []);

    return (
        <SafeAreaConsumer>
            {({paddingTop}) => (
                <Modal
                    isVisible={isVisible}
                    fullscreen
                    onClose={() => {}}
                    style={{backgroundColor: 'white'}}
                    innerContainerStyle={{flex: 1, marginTop: paddingTop}}
                >
                    <TestDriveBanner onPress={finishTestDrive} />
                    <TestDriveRenderer />
                </Modal>
            )}
        </SafeAreaConsumer>
    );
}

TestDrive.displayName = 'TestDrive';

export default TestDrive;
