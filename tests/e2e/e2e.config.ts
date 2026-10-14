import type {LanguageModelMiddleware} from 'ai';
import type {E2EConfig} from 'e2e';

import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {web} from '@e2e-dev/web';
import {wrapLanguageModel} from 'ai';
import {chatgpt} from 'e2e/oauth/chatgpt';

const callstack = createOpenAICompatible({
    name: 'callstack.ai',
    baseURL: 'https://api.callstack.ai/v1',
    apiKey: process.env.CALLSTACK_API_KEY,
    supportsStructuredOutputs: true,
    // Without it, screenshots in tool results are sent as base64 text and blow past the context window.
    supportsMultiPartToolContent: true,
});

// Apex invents arguments like {"__skip":"true"} for tools that take none, which fails validation and wastes a model call.
const emptyToolArgs: LanguageModelMiddleware = {
    wrapGenerate: async ({doGenerate, params}) => {
        const result = await doGenerate();
        const noArgTools = new Set(params.tools?.filter((tool) => tool.type === 'function' && Object.keys(tool.inputSchema.properties ?? {}).length === 0).map((tool) => tool.name));
        return {...result, content: result.content.map((part) => (part.type === 'tool-call' && noArgTools.has(part.toolName) ? {...part, input: '{}'} : part))};
    },
};

const system = [
    'You are a QA agent testing New Expensify.',
    'Stay strictly within the goal and the current instruction: once what they ask for is done and verified, stop and finish. Do not visit other tabs, screens, or flows they do not name.',
    'The app may show a loading screen for a few seconds after opening; that is expected. Plan from the goal anyway and wait for the screen instead of giving up.',
].join(' ');

export default {
    agents: {
        // Signed in with `npx e2e login openai`; `npx e2e models openai` lists the ids the plan serves.
        default: {
            model: chatgpt('gpt-6-luna'),
            providerOptions: {openai: {reasoningEffort: 'low'}},
            system,
        },
        apex: {
            model: wrapLanguageModel({model: callstack('callstack/Apex'), middleware: emptyToolArgs}),
            providerOptions: {openaiCompatible: {reasoningEffort: 'low'}},
            system,
        },
    },
    targets: [
        {
            name: 'web',
            // The backend answers 403 to the default headless agent ("HeadlessChrome"), so the app boots offline.
            engine: web({userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36'}),
            app: {
                // Start the dev server with `npm run web` first.
                url: 'https://dev.new.expensify.com:8082',
            },
        },
    ],
    tests: '**/*.e2e.ts',
} satisfies E2EConfig;
