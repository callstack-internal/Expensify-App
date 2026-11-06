/**
 * PoC of the package's `hosted` plugin: the preset rules oxlint can't run natively, run from their ESLint plugins' own
 * code. It imports nothing from the App. Consumers that need to wrap a rule, or host more rules, build their own
 * plugin from `plugin.rules` and `hostRule` (see config/oxlint/poc/app-hosted-rules.mjs).
 */
import {withEslintDirectiveIDs} from '../eslintDirectives.mjs';
import {STUBBED_PARSER_SERVICES, getPluginRules, hostedRuleIDs, splitRuleID} from '../rules.mjs';

// naming-convention requires parser services, which oxlint's JS plugins lack.
// getParserServices(context, true) tolerates a missing `program` but fails on missing node maps and
// reads context.languageOptions first, so both are stubbed. The presets' selectors never reach the
// type checker (no option sets `types`).
const STUB_PARSER_SERVICES = {
    esTreeNodeToTSNodeMap: new Map(),
    tsNodeToESTreeNodeMap: new Map(),
};

/**
 * Lets typescript-eslint's naming-convention run in oxlint. The rule fails without TypeScript parser
 * services, which oxlint's JS plugins do not have, so it gets STUB_PARSER_SERVICES instead.
 * @param {import('eslint').Rule.RuleModule} rule
 * @returns {import('eslint').Rule.RuleModule}
 */
function withStubbedParserServices(rule) {
    return {
        ...rule,
        create(context) {
            const sourceCode = context.sourceCode ?? context.getSourceCode();
            // A Proxy cannot do this: oxlint defines `parserServices` as a read-only, non-configurable
            // property, and a get trap may not return a different value for it.
            const stubbedSourceCode = Object.create(sourceCode, {
                parserServices: {value: STUB_PARSER_SERVICES},
            });
            const stubbedContext = Object.create(context, {
                sourceCode: {value: stubbedSourceCode},
                getSourceCode: {value: () => stubbedSourceCode},
                languageOptions: {
                    value: context.languageOptions ?? {parser: {meta: {name: 'oxlint-js-plugin'}}},
                },
            });
            return rule.create(stubbedContext);
        },
    };
}

/**
 * Loads one ESLint plugin rule as a hosted rule. `eslint-disable` comments that use its ESLint ID apply to it.
 * @param {string} ruleID the ESLint rule ID, like `react/jsx-no-bind`
 * @returns {import('eslint').Rule.RuleModule}
 */
function hostRule(ruleID) {
    const {prefix, name} = splitRuleID(ruleID);
    const rule = getPluginRules(prefix)[name];
    return withEslintDirectiveIDs(STUBBED_PARSER_SERVICES.has(ruleID) ? withStubbedParserServices(rule) : rule, ruleID);
}

const plugin = {
    meta: {
        name: 'hosted',
        version: '0.0.1',
    },
    rules: Object.fromEntries(hostedRuleIDs.map((ruleID) => [splitRuleID(ruleID).name, hostRule(ruleID)])),
};

export {hostRule};
export default plugin;
