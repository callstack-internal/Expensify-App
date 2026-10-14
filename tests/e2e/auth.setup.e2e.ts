import {test} from '@e2e-dev/web';
import fs from 'node:fs';
import path from 'node:path';

type StoredAuth = {session: string; credentials: string};

// NewDot keeps its login in the Onyx IndexedDB; caching these two keys locally skips the manual sign-in on later runs.
const AUTH_DIR = path.resolve('tests/e2e/.auth');
const SESSION_FILE = path.join(AUTH_DIR, 'session.json');
const CREDENTIALS_FILE = path.join(AUTH_DIR, 'credentials.json');
const SIGNED_IN_URL = /\/(home|inbox)/;

function readOnyxAuth(): Promise<StoredAuth> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('OnyxDB');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const transaction = request.result.transaction('keyvaluepairs', 'readonly');
            const store = transaction.objectStore('keyvaluepairs');
            const session = store.get('session');
            const credentials = store.get('credentials');
            transaction.onerror = () => reject(transaction.error);
            transaction.oncomplete = () => resolve({session: JSON.stringify(session.result ?? null), credentials: JSON.stringify(credentials.result ?? null)});
        };
    });
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

// The first run is headed and waits for a manual sign-in (email + magic code); later runs restore the cached login.
test.setup('sign in', {sessions: ['me'], timeout: 300_000}, async ({app, browser, session}) => {
    if (fs.existsSync(SESSION_FILE)) {
        const cached = {session: fs.readFileSync(SESSION_FILE, 'utf8'), credentials: fs.readFileSync(CREDENTIALS_FILE, 'utf8')};
        // A static file on the app's origin, so the auth keys land before the app boots.
        await app.open('/robots.txt');
        await browser.evaluate(writeOnyxAuth, cached);
    }

    await app.open('/');
    await browser.waitForURL(SIGNED_IN_URL, {timeout: 280_000});

    const auth = await browser.evaluate(readOnyxAuth);
    fs.mkdirSync(AUTH_DIR, {recursive: true});
    fs.writeFileSync(SESSION_FILE, auth.session);
    fs.writeFileSync(CREDENTIALS_FILE, auth.credentials);
    await session.save('me');
});
