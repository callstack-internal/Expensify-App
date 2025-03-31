import React from 'react';
import {Image, View} from 'react-native';
import FastTrackCover from '@assets/images/fast-track-cover.png';
import Button from '@components/Button';
import Modal from '@components/Modal';
import Text from '@components/Text';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import CONST from '@src/CONST';
import type OnboardingModalProps from './types';

function OnboardingModal({isVisible, onSkip, onStart}: OnboardingModalProps) {
    const styles = useThemeStyles();
    const theme = useTheme();
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const {windowWidth} = useWindowDimensions();

    return (
        <Modal
            type={shouldUseNarrowLayout ? CONST.MODAL.MODAL_TYPE.BOTTOM_DOCKED : CONST.MODAL.MODAL_TYPE.CENTERED_SMALL}
            isVisible={isVisible}
            innerContainerStyle={{
                maxWidth: 500,
                backgroundColor: theme.appBG,
                padding: 0,
                paddingTop: 0,
            }}
            onClose={onSkip}
        >
            <View>
                <View style={{maxWidth: shouldUseNarrowLayout ? windowWidth : 500, aspectRatio: 500 / 300}}>
                    <Image
                        source={FastTrackCover}
                        resizeMode="contain"
                        style={{
                            width: '100%',
                            height: '100%',
                            borderTopLeftRadius: 16,
                            borderTopRightRadius: 16,
                        }}
                    />
                </View>
                <View style={[styles.p5, styles.gap8]}>
                    <View style={styles.gap3}>
                        <Text style={[styles.textHeadlineH1, styles.themeTextColor]}>Want to takes us for a test drive?</Text>
                        <Text style={styles.textSupporting}>If you're new to Expensify, take a quick product tour to get up to speed fast. No pit stops required!</Text>
                    </View>
                    <View style={styles.gap3}>
                        <Button
                            text="Skip"
                            onPress={onSkip}
                        />
                        <Button
                            success
                            text="Start test drive"
                            onPress={onStart}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
}

OnboardingModal.displayName = 'OnboardingModal';

export default OnboardingModal;
