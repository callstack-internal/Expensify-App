// The App's own hosted rules (PoC). The package's `hosted` plugin only has the preset rules, so the App's plugin
// (app-hosted-rules.mjs) adds these, and ruleNames.mjs maps them back to their ESLint IDs.

// ESLint plugin rules no preset turns on but oxlint.config.mts does. oxlint has no native version of any of them.
const APP_HOSTED_RULES = [
    'jsdoc/require-jsdoc',
    'react/no-unused-prop-types',
    'storybook/await-interactions',
    'storybook/context-in-play-function',
    'storybook/default-exports',
    'storybook/hierarchy-separator',
    'storybook/no-redundant-story-name',
    'storybook/no-renderer-packages',
    'storybook/no-uninstalled-addons',
    'storybook/prefer-pascal-case',
    'storybook/story-exports',
    'storybook/use-storybook-expect',
    'storybook/use-storybook-testing-library',
];

// The App's own rules in the `hosted` plugin, and the ESLint rule ID each one reports as.
const LOCAL_HOSTED_RULES = {
    'no-deprecated-self-closing-jsx': '@typescript-eslint/no-deprecated',
};

export {APP_HOSTED_RULES, LOCAL_HOSTED_RULES};
