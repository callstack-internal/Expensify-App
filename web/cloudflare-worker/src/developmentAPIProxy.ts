/**
 * The local API proxy (`web/proxy.ts`) that Rsbuild forwards these paths to. The live Worker passes the same paths through
 * untouched, so this stays free of Worker types for the Rsbuild config, launcher, and proxy to import.
 */
const API_PROXY_PATHS = ['/api', '/staging', '/staging-secure', '/chat-attachments', '/receipts'];

const DEFAULT_API_PROXY_PORT = 9000;

/**
 * Port of the local API proxy. Every worktree shares 9000 by default, so a session reuses whichever proxy started first,
 * even one running older code. Setting API_PROXY_PORT gives a session its own proxy.
 */
function getAPIProxyPort(env: Record<string, string | undefined>): number {
    const port = Number.parseInt(env.API_PROXY_PORT ?? '', 10);
    return Number.isNaN(port) ? DEFAULT_API_PROXY_PORT : port;
}

/** API and attachment responses must never enter the SPA fallback or HTML nonce/cache pipeline. */
function isAPIRequest(pathname: string): boolean {
    return API_PROXY_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export {API_PROXY_PATHS, DEFAULT_API_PROXY_PORT, getAPIProxyPort, isAPIRequest};
