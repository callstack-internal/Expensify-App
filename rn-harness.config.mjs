const config = {
    include: ['./tests/unitui/**/*.harness.ts'],

    runners: [
        {
            name: 'android',
            platform: 'android',
            deviceId: 'Pixel_8_API_35',
            bundleId: 'com.expensify.chat.dev',
        },
        {
            name: 'ios',
            platform: 'ios',
            deviceId: 'iPhone 16 Pro',
            bundleId: 'com.expensify.chat.dev',
            systemVersion: '18.6',
        },
    ],
    defaultRunner: 'android',
    bridgeTimeout: 120000,
};

export default config;
