import {test} from '@e2e-dev/web';
import {expect, unique} from 'e2e';
import {z} from 'zod';

test('sends a message to my self DM', {session: 'me', requires: ['browser']}, async ({agent, app, screen}) => {
    const message = `e2e ping ${Date.now()}`;

    await app.open('/home');
    await agent.act('Open the chat with yourself (the self DM, marked as "(you)")');

    const composer = screen.getByPlaceholder('Write something...');
    await composer.fill(message);
    await composer.press('Enter');

    await expect(screen.getByText(message)).toBeVisible();
    await agent.assert(`The latest message in the chat reads "${message}" and is not marked as failed or pending`);
});

test('creates a manual expense', {session: 'me', requires: ['browser'], timeout: 300_000}, async ({agent, app, screen}) => {
    const merchant = unique(`E2E Merchant ${Date.now()}`);

    await app.open('/home');
    await agent.act('Create a manual expense of 12.34 with merchant {merchant}, submitted to yourself (no workspace), and confirm it', {params: {merchant}});

    await expect(screen.getByText(merchant.value).first()).toBeVisible();

    const expense = await agent.extract(`the amount and merchant of the expense for "${merchant.value}"`, {
        schema: z.object({amount: z.string(), merchant: z.string()}),
    });
    expect(expense.merchant).toBe(merchant.value);
    expect(expense.amount).toContain('12.34');
});
