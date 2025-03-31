import React from 'react';
import {View} from 'react-native';
import Button from '@components/Button';
import Text from '@components/Text';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';

type TestDriveBannerProps = {
    onPress: () => void;
};

function TestDriveBanner({onPress}: TestDriveBannerProps) {
    const styles = useThemeStyles();
    const {shouldUseNarrowLayout} = useResponsiveLayout();

    return (
        <View style={[styles.highlightBG, styles.gap2, styles.alignItemsCenter, styles.flexRow, styles.justifyContentCenter, {height: 40}]}>
            <Text>{shouldUseNarrowLayout ? "You're currently test driving Expensify" : 'Currently Test Driving Expensify. Ready to try out the real thing?'}</Text>
            <Button
                text="Get started"
                small
                success
                onPress={onPress}
            />
        </View>
    );
}

TestDriveBanner.displayName = 'TestDriveBanner';

export default TestDriveBanner;
