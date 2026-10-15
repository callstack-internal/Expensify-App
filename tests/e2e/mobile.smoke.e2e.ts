import {test} from '@e2e-dev/mobile';

test('app opens signed in', {requires: ['device'], timeout: 300_000}, async ({agent, app}) => {
    await app.open();
    // A cold Metro bundle keeps the splash up for minutes.
    await agent.waitFor('The Expensify app has finished loading past the splash screen', {timeout: 240_000});
    await agent.assert('The main screen with the bottom tab bar is shown, not the sign-in screen');
});
