import React, {useRef} from 'react';
import {Text, View} from 'react-native';
import Performance from 'react-native-performance';
import {startProfiling, stopProfiling} from 'react-native-release-profiler';

function SendMetricsButton() {
    const onPress = () => {
        const metrics = Performance.getEntries();
        // Change to your IP address
        fetch('http://192.168.0.103:8080', {
            method: 'POST',
            body: JSON.stringify(metrics),
        });
    };
    return (
        <Text
            style={{padding: 10, backgroundColor: 'green', opacity: 0.5}}
            onPress={onPress}
        >
            Send Metrics
        </Text>
    );
}

function ProfilingButton() {
    const ref = useRef(null);
    const active = useRef(false);
    const onPress = () => {
        if (active.current) {
            stopProfiling(true);
            active.current = false;
            ref.current.setNativeProps({style: {backgroundColor: 'green'}});
        } else {
            startProfiling();
            active.current = true;
            ref.current.setNativeProps({style: {backgroundColor: 'red'}});
        }
    };

    return (
        <Text
            ref={ref}
            onPress={onPress}
            style={{padding: 10, backgroundColor: 'green', opacity: 0.5}}
        >
            Profiling
        </Text>
    );
}

function PerfDevtools() {
    return (
        <View style={{position: 'absolute', bottom: 0, zIndex: 1000, flexDirection: 'row', gap: 20}}>
            <SendMetricsButton />
            <ProfilingButton />
        </View>
    );
}

export {PerfDevtools};
