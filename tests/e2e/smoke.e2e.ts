import {test} from '@e2e-dev/web';
import {expect} from 'e2e';

test('sign-in page opens', {requires: ['browser']}, async ({app, browser}) => {
    await app.open('/');
    await expect(browser.locator('body')).toBeVisible();
});
