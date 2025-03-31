import React, {useCallback, useEffect, useState} from 'react';
import {InteractionManager} from 'react-native';
import EmbeddedDemo from '@components/EmbeddedDemo';
import Modal from '@components/Modal';
import SafeAreaConsumer from '@components/SafeAreaConsumer';
import Navigation from '@libs/Navigation/Navigation';
import TestDriveBanner from './TestDriveBanner';

type TestDriveProps = {};

function TestDriveDemo({}: TestDriveProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        InteractionManager.runAfterInteractions(() => {
            setIsVisible(true);
        });
    }, []);

    const closeModal = useCallback(() => {
        setIsVisible(false);
        InteractionManager.runAfterInteractions(() => {
            Navigation.goBack();
        });
    }, []);

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
                    <TestDriveBanner onPress={closeModal} />
                    <EmbeddedDemo
                        url="https://app.storylane.io/demo/jiletmctlfcs?embed=inline"
                        iframeTitle="Test Drive"
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        iframeProps={{'data-navattic-demo-id': 'clzt21qk0000109l46k8tbtce'}}
                    />
                </Modal>
            )}
        </SafeAreaConsumer>
    );
}

TestDriveDemo.displayName = 'TestDriveDemo';

export default TestDriveDemo;
