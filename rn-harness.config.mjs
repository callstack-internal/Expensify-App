const config = {
    include: ['./tests/unitui/**/*.harness.ts'],

    runners: [
        {
            name: 'android',
            platform: 'android',
            deviceId: 'Pixel_7',
            bundleId: 'org.me.mobiexpensifyg.dev',
            activityName: 'org.me.mobiexpensifyg.ExpensifyActivityBase',
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
