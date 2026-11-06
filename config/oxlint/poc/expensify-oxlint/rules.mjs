// The rule lists the package's plugins and the App's ruleNames.mjs read, written by buildExpensifyOxlint.mjs.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const repoRoot = new URL('../../../../', import.meta.url).pathname;
const expensifyConfigDirectory = path.dirname(require.resolve('eslint-config-expensify', {paths: [repoRoot]}));
const {coreRuleNames, hostedRuleIDs, pluginPackages, eslintRuleRenames} = JSON.parse(fs.readFileSync(new URL('rules.json', import.meta.url), 'utf8'));

function splitRuleID(ruleID) {
    const slash = ruleID.lastIndexOf('/');
    return slash === -1 ? {prefix: '', name: ruleID} : {prefix: ruleID.slice(0, slash), name: ruleID.slice(slash + 1)};
}

function getPluginRules(prefix) {
    // The presets' ESLint plugins are dependencies of eslint-config-expensify, so they are looked up there first.
    const plugin = require(require.resolve(pluginPackages[prefix], {paths: [expensifyConfigDirectory, repoRoot]}));
    return plugin.rules ?? plugin.default?.rules ?? {};
}

const STUBBED_PARSER_SERVICES = new Set(['@typescript-eslint/naming-convention']);

export {STUBBED_PARSER_SERVICES, coreRuleNames, eslintRuleRenames as ESLINT_RULE_RENAMES, getPluginRules, hostedRuleIDs, splitRuleID};
