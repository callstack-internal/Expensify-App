import React from 'react';
import {View} from 'react-native';
import Button from '@components/Button';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';
import type TestDriveBannerProps from './types';

function TestDriveBanner({onPress}: TestDriveBannerProps) {
    const styles = useThemeStyles();
    return (
        <View style={[{height: 40}, styles.gap2, styles.alignItemsCenter, styles.flexRow, styles.justifyContentCenter]}>
            <Text>Currently Test Driving Expensify. Ready to try out the real thing?</Text>
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
