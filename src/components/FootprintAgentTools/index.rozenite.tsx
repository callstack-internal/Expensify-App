import {getOnyxProbeReport, isOnyxProbeRunning, startOnyxProbe, stopOnyxProbe} from '@libs/OnyxSubscriptionProbe';
import type {OnyxProbeReport} from '@libs/OnyxSubscriptionProbe';

import type {AgentTool} from '@rozenite/agent-bridge';

import {useRozeniteInAppAgentTool} from '@rozenite/agent-bridge';

/**
 * Exposes the Onyx subscription probe as Rozenite agent tools under the `app` domain, so the footprint
 * harness can start and stop counting around a flow instead of a human typing into a debugger console.
 *
 * Only resolved when Metro runs with `WITH_ROZENITE=true`. See `index.tsx` for why.
 */

const startTool: AgentTool = {
    name: 'onyx-probe-start',
    description: 'Start counting Onyx subscription activity. Resets any counts from a previous run.',
    inputSchema: {
        type: 'object',
        properties: {},
    },
};

const stopTool: AgentTool = {
    name: 'onyx-probe-stop',
    description: 'Stop counting Onyx subscription activity, restore the connection manager, and return the report.',
    inputSchema: {
        type: 'object',
        properties: {},
    },
};

const peekTool: AgentTool = {
    name: 'onyx-probe-peek',
    description: 'Return the Onyx subscription report so far without stopping the probe.',
    inputSchema: {
        type: 'object',
        properties: {},
    },
};

type StartResult = {started: boolean; alreadyRunning: boolean};

function FootprintAgentTools() {
    useRozeniteInAppAgentTool<Record<string, never>, StartResult>({
        tool: startTool,
        handler: () => {
            const alreadyRunning = isOnyxProbeRunning();
            startOnyxProbe();
            return {started: true, alreadyRunning};
        },
    });

    useRozeniteInAppAgentTool<Record<string, never>, OnyxProbeReport>({
        tool: stopTool,
        handler: () => stopOnyxProbe(),
    });

    useRozeniteInAppAgentTool<Record<string, never>, OnyxProbeReport>({
        tool: peekTool,
        handler: () => getOnyxProbeReport(),
    });

    return null;
}

FootprintAgentTools.displayName = 'FootprintAgentTools';

export default FootprintAgentTools;
