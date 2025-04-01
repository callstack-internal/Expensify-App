import React from 'react';
import {View} from 'react-native';
import Button from '@components/Button';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';

type TestDriveBannerProps = {
    onPress: () => void;
};

function TestDriveBanner({onPress}: TestDriveBannerProps) {
    const styles = useThemeStyles();
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const {translate} = useLocalize();

    return (
        <View style={[styles.highlightBG, styles.gap2, styles.alignItemsCenter, styles.flexRow, styles.justifyContentCenter, {height: 40}]}>
            <Text>
                {shouldUseNarrowLayout
                    ? translate('onboarding.currentlyTestDrivingExpensify')
                    : `${translate('onboarding.currentlyTestDrivingExpensify')}. ${translate('onboarding.readyForTheRealThing')}`}
            </Text>
            <Button
                text={translate('onboarding.getStarted')}
                small
                success
                onPress={onPress}
            />
        </View>
    );
}

TestDriveBanner.displayName = 'TestDriveBanner';

export default TestDriveBanner;
