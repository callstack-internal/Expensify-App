import React from 'react';
import {Text} from 'react-native';
import Performance from 'react-native-performance';

const onPress = () => {
    const metrics = Performance.getEntries();
    fetch('http://10.0.2.2:8080', {
        method: 'POST',
        body: JSON.stringify(metrics),
    });
};

function PerfDevtools() {
    return (
        <Text
            onPress={onPress}
            style={{position: 'absolute', bottom: 0, zIndex: 1000}}
        >
            __reassure__
        </Text>
    );
}

const perf = {
    marks: {
        messageSent: '[SendMessage]Sent',
    },
    measurments: {
        messageProcessing: '[SendMessage]ProcessingTime',
    },
    data: {
        message: null,
    },
};

export {perf, PerfDevtools};
