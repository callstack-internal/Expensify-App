/**
 * The App's `hosted` plugin (PoC). It takes the package's hosted rules as they are, wraps the two that React Compiler
 * gates, and adds the App's own hosted rules. oxlint.config.mts points the package's `hosted` entry at this file, so
 * every rule keeps its `hosted/<name>` name and ESLint ID.
 */
import {EXHAUSTIVE_DEPS_USECALLBACK_USEMEMO_PATTERN} from '../../reactCompiler/suppressedRules.mjs';
import {withEslintDirectiveIDs} from '../eslintDirectives.mjs';
import {create as noDeprecatedSelfClosingJsxCreate, meta as noDeprecatedSelfClosingJsxMeta} from '../noDeprecatedSelfClosingJsx.mjs';
import {withFullGating, withMessageGating} from '../reactCompilerGate.mjs';
import {APP_HOSTED_RULES} from './appHostedRules.mjs';
import packageHosted, {hostRule} from './expensify-oxlint/plugins/hosted-rules.mjs';

const presetRules = packageHosted.rules;

const plugin = {
    meta: {
        name: 'hosted',
        version: '0.0.1',
    },
    rules: {
        ...presetRules,
        ...Object.fromEntries(APP_HOSTED_RULES.map((ruleID) => [ruleID.slice(ruleID.lastIndexOf('/') + 1), hostRule(ruleID)])),
        // In files React Compiler memoizes, reactCompilerGate.mjs drops all jsx-no-constructed-context-values reports and
        // the useCallback/useMemo reports of exhaustive-deps.
        'jsx-no-constructed-context-values': withFullGating(presetRules['jsx-no-constructed-context-values']),
        'exhaustive-deps': withMessageGating(presetRules['exhaustive-deps'], EXHAUSTIVE_DEPS_USECALLBACK_USEMEMO_PATTERN),
        'no-deprecated-self-closing-jsx': withEslintDirectiveIDs({create: noDeprecatedSelfClosingJsxCreate, meta: noDeprecatedSelfClosingJsxMeta}, '@typescript-eslint/no-deprecated'),
    },
};

export default plugin;
