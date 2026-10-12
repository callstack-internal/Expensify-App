import type {E2EConfig} from 'e2e';

import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {web} from '@e2e-dev/web';

const callstack = createOpenAICompatible({
    name: 'callstack.ai',
    baseURL: 'https://api.callstack.ai/v1',
    apiKey: process.env.CALLSTACK_API_KEY,
});

export default {
    agents: {
        default: {
            model: callstack('callstack/Apex'),
            providerOptions: {openaiCompatible: {reasoningEffort: 'xhigh'}},
            system: 'You are a thorough QA agent testing New Expensify. Verify every outcome.',
        },
    },
    targets: [
        {
            name: 'web',
            engine: web(),
            app: {
                // Start the dev server with `npm run web` first.
                url: 'https://dev.new.expensify.com:8082',
            },
        },
    ],
    tests: '**/*.e2e.ts',
} satisfies E2EConfig;
