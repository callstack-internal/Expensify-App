/** The Worker must pass through exactly the paths Rsbuild proxies to the API, or API responses get SPA handling. */
import assert from 'node:assert/strict';
import {describe, test} from 'node:test';

import {API_PROXY_PATHS, DEFAULT_API_PROXY_PORT, getAPIProxyPort, isAPIRequest} from '../src/developmentAPIProxy.ts';

describe('live development API passthrough', () => {
    test('passes through every path Rsbuild proxies to the API', () => {
        // Given the shared list Rsbuild also proxies
        for (const prefix of API_PROXY_PATHS) {
            // When the Worker classifies the prefix and paths beneath it
            // Then they bypass the SPA fallback and HTML handling
            assert.ok(isAPIRequest(prefix), prefix);
            assert.ok(isAPIRequest(`${prefix}/Command?x=1`), prefix);
        }
    });

    test('does not treat app routes that only share a prefix as API requests', () => {
        // Given app paths that start with the same letters
        // When the Worker classifies them
        // Then they still get the app shell
        for (const prefix of API_PROXY_PATHS) {
            assert.equal(isAPIRequest(`${prefix}x`), false, prefix);
        }
        assert.equal(isAPIRequest('/settings'), false);
    });

    test('uses API_PROXY_PORT when set, so a session can run its own proxy', () => {
        // Given one session that sets its own proxy port and one that sets nothing or garbage
        // When each resolves the proxy port
        // Then the override wins, and anything else falls back to the shared default
        assert.equal(getAPIProxyPort({API_PROXY_PORT: '9001'}), 9001);
        assert.equal(getAPIProxyPort({}), DEFAULT_API_PROXY_PORT);
        assert.equal(getAPIProxyPort({API_PROXY_PORT: 'not-a-port'}), DEFAULT_API_PROXY_PORT);
    });
});
