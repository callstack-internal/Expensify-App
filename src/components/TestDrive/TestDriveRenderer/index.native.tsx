import React from 'react';
import WebView from 'react-native-webview';

function TestDriveRenderer() {
    return (
        <WebView
            source={{
                uri: 'https://capture.navattic.com/clzt21qk0000109l46k8tbtce',
            }}
            style={{
                flex: 1,
            }}
        />
    );
}

TestDriveRenderer.displayName = 'TestDriveRenderer';

export default TestDriveRenderer;
