import React from 'react';
import Modal from '@components/Modal';
import SafeAreaConsumer from '@components/SafeAreaConsumer';
import TestDriveBanner from './TestDriveBanner';
import TestDriveRenderer from './TestDriveRenderer';
import type TestDriveProps from './types';

function TestDrive({isVisible, onFinish}: TestDriveProps) {
    return (
        <SafeAreaConsumer>
            {({paddingTop, paddingBottom}) => (
                <Modal
                    isVisible={isVisible}
                    fullscreen
                    onClose={() => {}}
                    style={{backgroundColor: 'white'}}
                    innerContainerStyle={{flex: 1, marginTop: paddingTop, marginBottom: paddingBottom}}
                >
                    <TestDriveBanner onPress={onFinish} />
                    <TestDriveRenderer />
                </Modal>
            )}
        </SafeAreaConsumer>
    );
}

TestDrive.displayName = 'TestDrive';

export default TestDrive;
