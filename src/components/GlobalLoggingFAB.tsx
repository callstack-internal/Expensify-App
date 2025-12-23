import React, {useEffect} from 'react';
import {View} from 'react-native';
import Onyx from 'react-native-onyx';
import Animated, {interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withTiming} from 'react-native-reanimated';
import useOnyx from '@hooks/useOnyx';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {setShouldStoreLogs} from '@libs/actions/Console';
import {parseStringifiedMessages} from '@libs/Console';
import localFileCreate from '@libs/localFileCreate';
import Navigation from '@libs/Navigation/Navigation';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import Icon from './Icon';
import * as Expensicons from './Icon/Expensicons';
import PressableWithoutFeedback from './Pressable/PressableWithoutFeedback';

function GlobalLoggingFAB() {
    const [shouldStoreLogs] = useOnyx(ONYXKEYS.SHOULD_STORE_LOGS);
    const [capturedLogs] = useOnyx(ONYXKEYS.LOGS);
    const theme = useTheme();
    const styles = useThemeStyles();
    const pulseAnim = useSharedValue(0);

    // Pulse animation when logging is active
    useEffect(() => {
        if (shouldStoreLogs) {
            pulseAnim.value = withRepeat(withTiming(1, {duration: 1500}), -1, true);
        } else {
            pulseAnim.value = withTiming(0, {duration: 300});
        }
    }, [shouldStoreLogs, pulseAnim]);

    const animatedStyle = useAnimatedStyle(() => {
        const backgroundColor = interpolateColor(
            pulseAnim.value,
            [0, 1],
            [shouldStoreLogs ? theme.success : theme.buttonDefaultBG, shouldStoreLogs ? theme.successHover : theme.buttonDefaultBG],
        );

        const scale = shouldStoreLogs ? 1 + pulseAnim.value * 0.05 : 1;

        return {
            backgroundColor,
            transform: [{scale}],
        };
    });

    const handleToggle = () => {
        // If currently logging, stop and share logs
        if (shouldStoreLogs) {
            setShouldStoreLogs(false);

            // Capture current logs before clearing
            const logsList = Object.values(capturedLogs ?? {});

            // Clear logs from Onyx immediately
            Onyx.set(ONYXKEYS.LOGS, {});

            // Share logs if there are any
            if (logsList.length === 0) {
                return;
            }

            const logsWithParsedMessages = parseStringifiedMessages(logsList);

            // Generate a file with the logs and navigate to share
            localFileCreate('logs', JSON.stringify(logsWithParsedMessages, null, 2)).then(({path}) => {
                Navigation.navigate(ROUTES.SETTINGS_SHARE_LOG.getRoute(path));
            });
        } else {
            // Start logging
            setShouldStoreLogs(true);
        }
    };

    return (
        <View style={styles.globalLoggingFABContainer}>
            <PressableWithoutFeedback
                onPress={handleToggle}
                accessibilityLabel={shouldStoreLogs ? 'Stop logging and share' : 'Start logging'}
                accessibilityRole="button"
            >
                <Animated.View style={[styles.globalLoggingFAB, animatedStyle]}>
                    <Icon
                        src={Expensicons.Bug}
                        fill={shouldStoreLogs ? theme.iconMenu : theme.icon}
                        width={24}
                        height={24}
                    />
                </Animated.View>
            </PressableWithoutFeedback>
        </View>
    );
}

GlobalLoggingFAB.displayName = 'GlobalLoggingFAB';

export default GlobalLoggingFAB;
