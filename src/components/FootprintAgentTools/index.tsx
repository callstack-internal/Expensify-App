/**
 * Default (and production) implementation: renders nothing and pulls in no Rozenite code.
 *
 * The real implementation lives in `index.rozenite.tsx` and resolves only when Metro runs with
 * `WITH_ROZENITE=true`, which prepends `rozenite.tsx` to `resolver.sourceExts`. That keeps
 * `@rozenite/agent-bridge` out of the module graph, and so out of the bundle, on every normal dev
 * server, CI bundle and release build.
 */
function FootprintAgentTools() {
    return null;
}

FootprintAgentTools.displayName = 'FootprintAgentTools';

export default FootprintAgentTools;
