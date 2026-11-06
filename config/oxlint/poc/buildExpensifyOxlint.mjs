/**
 * PoC of the publish step eslint-config-expensify would run: converts the presets once (derive.mjs) and writes a
 * ready-made oxlint config plus the rule lists its `core` and `hosted` plugins need. Consumers then `extends` it and
 * never run @oxlint/migrate.
 *
 *     node config/oxlint/poc/buildExpensifyOxlint.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {APP_HOSTED_RULES, ESLINT_RULE_RENAMES, coreRuleNames, extendOxlintConfig, hostedRuleIDs} from '../derive.mjs';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'expensify-oxlint');

const PLUGIN_PACKAGES = {
    react: 'eslint-plugin-react',
    import: 'eslint-plugin-import',
    jsdoc: 'eslint-plugin-jsdoc',
    '@typescript-eslint': '@typescript-eslint/eslint-plugin',
    'react-hooks': 'eslint-plugin-react-hooks',
    storybook: 'eslint-plugin-storybook',
};

const {overrides, ...rest} = extendOxlintConfig({});
// The package's plugins replace the App's `core` and `hosted` ones. The written file keeps no machine paths:
// `./plugins/...` is relative to the package, other `./` paths to the repo, and npm plugins are package names.
// index.mjs turns them into absolute paths when it loads.
const jsPlugins = rest.jsPlugins.map((plugin) => {
    if (plugin.name === 'core' || plugin.name === 'hosted') {
        return {name: plugin.name, specifier: `./plugins/${plugin.name}-rules.mjs`};
    }
    if (path.isAbsolute(plugin.specifier)) {
        return {name: plugin.name, specifier: `eslint-plugin-${plugin.name}`};
    }
    return plugin;
});
const config = {...rest, jsPlugins, overrides};

// Only the rules the presets turn on. The App adds its own hosted rules in its own plugin.
const presetHostedRuleIDs = hostedRuleIDs.filter((ruleID) => !APP_HOSTED_RULES.includes(ruleID));
// Every plugin the package can host from, so consumers can host extra rules with hostRule(). Package names, resolved
// when the plugins load.
const pluginPackages = PLUGIN_PACKAGES;

fs.writeFileSync(path.join(outDir, 'oxlint.json'), `${JSON.stringify(config, null, 2)}\n`);
fs.writeFileSync(
    path.join(outDir, 'rules.json'),
    `${JSON.stringify({coreRuleNames, hostedRuleIDs: presetHostedRuleIDs, pluginPackages, eslintRuleRenames: ESLINT_RULE_RENAMES}, null, 2)}\n`,
);
process.stdout.write(`wrote ${Object.keys(config.rules).length} root rules and ${overrides.length} overrides\n`);
