import React from 'react';
import {Text} from 'react-native';
import Performance from 'react-native-performance';

const onPress = () => {
    const metrics = Performance.getEntries();
    fetch('http://192.168.1.10:8000', {
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
