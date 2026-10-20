import type {LanguageModelMiddleware} from 'ai';
import type {E2EConfig} from 'e2e';

import {anthropic} from '@ai-sdk/anthropic';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {mobile} from '@e2e-dev/mobile';
import {mobileTools} from '@e2e-dev/mobile/tools';
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

const ios = mobile({platform: 'ios', device: process.env.E2E_IOS_DEVICE});
const android = mobile({platform: 'android', device: process.env.E2E_ANDROID_DEVICE});

// Debug build that loads its JS from Metro; start it with `npm start` first and sign in once on the device, the app keeps the login between runs.
const nativeApp = {bundleId: 'com.expensify.chat.dev'};

const system = [
    'You are a QA agent testing New Expensify.',
    'Stay strictly within the goal and the current instruction: once what they ask for is done and verified, stop and finish. Do not visit other tabs, screens, or flows they do not name.',
    'The app may show a loading screen for a few seconds after opening; that is expected. Plan from the goal anyway and wait for the screen instead of giving up.',
].join(' ');

export default {
    agents: {
        // Reads ANTHROPIC_API_KEY.
        default: {
            model: anthropic('claude-sonnet-5-5'),
            providerOptions: {anthropic: {effort: 'low'}},
            system,
            tools: mobileTools(ios, android),
        },
        // Signed in with `npx e2e login openai`; `npx e2e models openai` lists the ids the plan serves.
        luna: {
            model: chatgpt('gpt-6-luna'),
            providerOptions: {openai: {reasoningEffort: 'low'}},
            system,
            tools: mobileTools(ios, android),
        },
        apex: {
            model: wrapLanguageModel({model: callstack('callstack/Apex'), middleware: emptyToolArgs}),
            providerOptions: {openaiCompatible: {reasoningEffort: 'low'}},
            system,
            tools: mobileTools(ios, android),
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
        {
            // Deployed staging build, for reproducing deploy blockers against the version QA tested.
            name: 'staging',
            engine: web({userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36'}),
            app: {url: 'https://staging.new.expensify.com'},
        },
        {
            // A PR's ad-hoc web build (https://<PR>.pr-testing.expensify.com), which talks to the staging backend.
            name: 'pr',
            engine: web({userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36'}),
            app: {url: process.env.E2E_PR_URL ?? 'https://staging.new.expensify.com'},
        },
        {
            // The same build at phone width, for the narrow layout.
            name: 'pr-mobile',
            engine: web({
                viewport: {width: 390, height: 844},
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
            }),
            app: {url: process.env.E2E_PR_URL ?? 'https://staging.new.expensify.com'},
        },
        {name: 'ios', engine: ios, app: nativeApp},
        {name: 'android', engine: android, app: nativeApp},
    ],
    workers: 1,
    tests: '**/*.e2e.ts',
} satisfies E2EConfig;
