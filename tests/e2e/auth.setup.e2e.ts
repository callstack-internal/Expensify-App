import {test} from '@e2e-dev/web';

// Run headed and sign in by hand (email + magic code); the session is saved once the app leaves the sign-in page.
test.setup('sign in manually', {sessions: ['me'], timeout: 300_000}, async ({app, browser, session}) => {
    await app.open('/');
    await browser.waitForURL(/\/(home|inbox)/, {timeout: 280_000});
    await session.save('me');
});
