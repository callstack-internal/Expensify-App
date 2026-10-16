import type {Browser} from '@e2e-dev/web';

import {test} from '@e2e-dev/web';
import fs from 'node:fs';
import path from 'node:path';

import createSeededAccount from './seed';

type StoredAuth = {session: string; credentials: string};

// NewDot keeps its login in the Onyx IndexedDB; caching these two keys locally skips the manual sign-in on later runs.
const AUTH_ROOT = path.resolve(import.meta.dirname, '.auth');
const SIGN_IN_TIMEOUT_MS = 280_000;

function readOnyxAuth(): Promise<StoredAuth> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('OnyxDB');
        // Before the app boots the DB doesn't exist yet; abort instead of creating an empty one.
        request.onupgradeneeded = () => request.transaction?.abort();
        request.onerror = () => resolve({session: 'null', credentials: 'null'});
        request.onsuccess = () => {
            if (!request.result.objectStoreNames.contains('keyvaluepairs')) {
                request.result.close();
                resolve({session: 'null', credentials: 'null'});
                return;
            }
            const transaction = request.result.transaction('keyvaluepairs', 'readonly');
            const store = transaction.objectStore('keyvaluepairs');
            const session = store.get('session');
            const credentials = store.get('credentials');
            transaction.onerror = () => reject(transaction.error);
            transaction.oncomplete = () => {
                request.result.close();
                resolve({session: JSON.stringify(session.result ?? null), credentials: JSON.stringify(credentials.result ?? null)});
            };
        };
    });
}

function hasAuthToken(session: string): boolean {
    const parsed: unknown = JSON.parse(session);
    return typeof parsed === 'object' && parsed !== null && 'authToken' in parsed && !!parsed.authToken;
}

function writeOnyxAuth(auth: StoredAuth): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('OnyxDB');
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => request.result.createObjectStore('keyvaluepairs');
        request.onsuccess = () => {
            const transaction = request.result.transaction('keyvaluepairs', 'readwrite');
            const store = transaction.objectStore('keyvaluepairs');
            store.put(JSON.parse(auth.session), 'session');
            store.put(JSON.parse(auth.credentials), 'credentials');
            transaction.onerror = () => reject(transaction.error);
            transaction.oncomplete = () => {
                request.result.close();
                resolve(true);
            };
        };
    });
}

// The URL can't tell signed-in from signed-out (staging shows the login form on /home), so wait for the auth token itself.
async function waitForAuthToken(browser: Browser): Promise<StoredAuth> {
    const deadline = Date.now() + SIGN_IN_TIMEOUT_MS;
    let auth = await browser.evaluate(readOnyxAuth);
    while (!hasAuthToken(auth.session)) {
        if (Date.now() > deadline) {
            throw new Error('Timed out waiting for sign-in');
        }
        await new Promise((resolve) => {
            setTimeout(resolve, 2000);
        });
        auth = await browser.evaluate(readOnyxAuth);
    }
    return auth;
}

// A fresh staging account with fixture data (see seed.ts) for every run, so explore spends no steps on setup.
test.setup('seeded account', {sessions: ['seeded'], requires: ['browser'], timeout: 120_000}, async ({app, browser, session}) => {
    const account = await createSeededAccount();
    await app.open('/robots.txt');
    await browser.evaluate(writeOnyxAuth, {session: JSON.stringify(account), credentials: JSON.stringify({login: account.email})});
    await app.open('/');
    await waitForAuthToken(browser);
    await session.save('seeded');
});

// The first run is headed and waits for a manual sign-in (email + magic code); later runs restore the cached login.
test.setup('sign in', {sessions: ['me'], requires: ['browser'], timeout: 300_000}, async ({app, browser, session}) => {
    // One cache per host, so dev and staging logins don't overwrite each other.
    const authDir = path.join(AUTH_ROOT, new URL(app.baseUrl ?? '').host);
    const sessionFile = path.join(authDir, 'session.json');
    const credentialsFile = path.join(authDir, 'credentials.json');

    if (fs.existsSync(sessionFile)) {
        const cached = {session: fs.readFileSync(sessionFile, 'utf8'), credentials: fs.readFileSync(credentialsFile, 'utf8')};
        // A static file on the app's origin, so the auth keys land before the app boots.
        await app.open('/robots.txt');
        await browser.evaluate(writeOnyxAuth, cached);
    }

    await app.open('/');

    const auth = await waitForAuthToken(browser);
    fs.mkdirSync(authDir, {recursive: true});
    fs.writeFileSync(sessionFile, auth.session);
    fs.writeFileSync(credentialsFile, auth.credentials);
    await session.save('me');
});
