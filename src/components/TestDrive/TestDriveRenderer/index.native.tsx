import React from 'react';
import WebView from 'react-native-webview';

function TestDriveRenderer() {
    return (
        <WebView
            source={{
                uri: 'https://app.storylane.io/demo/jiletmctlfcs?embed=inline',
            }}
            originWhitelist={['http://', 'https://', 'about:']}
            style={{
                flex: 1,
            }}
        />
    );
}

TestDriveRenderer.displayName = 'TestDriveRenderer';

export default TestDriveRenderer;
