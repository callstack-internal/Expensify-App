// What `import expensifyOxlint from 'eslint-config-expensify/oxlint'` would return: a static config, no conversion.
// The JSON holds no machine paths, so plugin specifiers are made absolute here.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const packageDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(packageDirectory, '../../../..');
const expensifyConfigDirectory = path.dirname(require.resolve('eslint-config-expensify', {paths: [repoRoot]}));

/**
 * @param {string} specifier `./plugins/...` (in this package), another `./` path (in the repo), or an npm package name
 * @returns {string} an absolute path
 */
function resolveSpecifier(specifier) {
    if (specifier.startsWith('./plugins/')) {
        return path.join(packageDirectory, specifier);
    }
    if (specifier.startsWith('./')) {
        return path.join(repoRoot, specifier);
    }
    return require.resolve(specifier, {paths: [expensifyConfigDirectory, repoRoot]});
}

/** @type {import('oxlint').OxlintConfig} */
const generated = JSON.parse(fs.readFileSync(new URL('oxlint.json', import.meta.url), 'utf8'));

/** @type {import('oxlint').OxlintConfig} */
const expensifyOxlint = {
    ...generated,
    jsPlugins: (generated.jsPlugins ?? []).map((jsPlugin) => (typeof jsPlugin === 'string' ? jsPlugin : {...jsPlugin, specifier: resolveSpecifier(jsPlugin.specifier)})),
};

export default expensifyOxlint;
