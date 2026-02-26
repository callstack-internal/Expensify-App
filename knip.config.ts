import type {KnipConfig} from 'knip';

const config: KnipConfig = {
    entry: [
        // Main app entry
        'index.js',
        'src/App.tsx',

        // Platform-specific files (resolved by Metro/webpack at build time)
        'src/**/*.native.{ts,tsx}',
        'src/**/*.ios.{ts,tsx}',
        'src/**/*.android.{ts,tsx}',
        'src/**/*.website.{ts,tsx}',

        // Webpack & Metro configs
        'config/webpack/*.ts',
        'metro.config.js',
        'babel.config.js',

        // Jest config & test files
        'jest.config.js',
        'tests/**/*.{ts,tsx,js}',

        // Storybook
        '.storybook/*.{ts,tsx}',
        'src/**/*.stories.{ts,tsx}',

        // GitHub Actions source files
        '.github/actions/javascript/*/index.ts',
        '.github/scripts/*.ts',

        // CLI / tooling scripts
        'scripts/*.{ts,js,sh}',
        'web/proxy.ts',

        // Local modules entry points
        'modules/*/src/**/*.{ts,tsx}',
    ],

    project: ['src/**/*.{ts,tsx,js,jsx}'],

    ignore: [
        // Generated parsers (peggy output)
        'src/libs/SearchParser/searchParser.js',
        'src/libs/SearchParser/autocompleteParser.js',

        // NCC-bundled GitHub Actions
        '.github/actions/javascript/*/index.js',

        // Mobile-Expensify submodule
        'Mobile-Expensify/**',

        // Build output
        'dist/**',
        'android/**',
        'ios/**',

        // Docs site
        'docs/**',
    ],

    ignoreDependencies: [
        // Babel plugins (referenced as strings in babel.config.js)
        '@babel/plugin-proposal-class-properties',
        '@babel/plugin-proposal-export-namespace-from',
        '@babel/plugin-proposal-private-methods',
        '@babel/plugin-proposal-private-property-in-object',
        '@babel/plugin-transform-class-properties',
        '@babel/plugin-transform-export-namespace-from',
        '@babel/plugin-transform-flow-strip-types',
        '@babel/preset-env',
        '@babel/preset-flow',
        '@babel/preset-react',
        '@babel/preset-typescript',
        'babel-plugin-module-resolver',
        'babel-plugin-react-compiler',
        'babel-plugin-react-native-web',
        'babel-plugin-transform-remove-console',
        'react-native-worklets/plugin',
        '@fullstory/babel-plugin-annotate-react',
        '@fullstory/babel-plugin-react-native',
        '@fullstory/react-native',

        // Webpack loaders & plugins (referenced by string or require)
        '@svgr/webpack',
        'babel-loader',
        'css-loader',
        'style-loader',
        '@vue/preload-webpack-plugin',
        'clean-webpack-plugin',
        'copy-webpack-plugin',
        'html-webpack-plugin',
        'mini-css-extract-plugin',
        '@sentry/webpack-plugin',
        'webpack-bundle-analyzer',
        '@pmmmwh/react-refresh-webpack-plugin',
        'react-refresh',
        'terser-webpack-plugin',

        // React Native build tooling (not imported in JS)
        '@react-native-community/cli',
        '@react-native-community/cli-platform-android',
        '@react-native-community/cli-platform-ios',
        '@react-native/babel-preset',
        '@react-native/metro-config',
        'react-native-clean-project',

        // Metro
        'metro-symbolicate',

        // Rock (dev server)
        'rock',
        '@rock-js/platform-android',
        '@rock-js/platform-ios',
        '@rock-js/plugin-metro',
        '@rock-js/provider-s3',

        // Expo autolinking / native modules (not imported directly)
        'expo-modules-core',

        // Jest tooling
        'babel-jest',
        'jest-circus',
        'jest-cli',
        'jest-environment-jsdom',
        'jest-expo',
        'jest-transformer-svg',
        'ts-jest',

        // Storybook addons (referenced in .storybook config)
        '@storybook/addon-a11y',
        '@storybook/addon-docs',
        '@storybook/addon-webpack5-compiler-babel',
        '@storybook/cli',
        '@storybook/react',
        '@storybook/react-webpack5',
        'storybook',

        // Prettier plugins
        '@prettier/plugin-oxc',
        '@trivago/prettier-plugin-sort-imports',

        // ESLint configs & plugins (referenced in eslint config)
        'eslint-config-airbnb-typescript',
        'eslint-config-expensify',
        'eslint-config-prettier',
        'eslint-plugin-file-progress',
        'eslint-plugin-jest',
        'eslint-plugin-jsdoc',
        'eslint-plugin-lodash',
        'eslint-plugin-react-native-a11y',
        'eslint-plugin-storybook',
        'eslint-plugin-testing-library',
        'eslint-plugin-you-dont-need-lodash-underscore',
        '@dword-design/eslint-plugin-import-alias',
        'typescript-eslint',

        // Native build dependencies (Fastlane, CocoaPods, etc.)
        'nitrogen',
        '@vercel/ncc',

        // Types packages (used via @types/* convention)
        '@types/base-64',
        '@types/canvas-size',
        '@types/concurrently',
        '@types/d3-scale',
        '@types/howler',
        '@types/jest',
        '@types/jest-when',
        '@types/js-yaml',
        '@types/lodash-es',
        '@types/mapbox-gl',
        '@types/mime-db',
        '@types/node',
        '@types/pako',
        '@types/pusher-js',
        '@types/react',
        '@types/react-collapse',
        '@types/react-dom',
        '@types/react-is',
        '@types/react-native-web',
        '@types/react-test-renderer',
        '@types/semver',
        '@types/setimmediate',
        '@types/webpack',
        '@types/webpack-bundle-analyzer',

        // Polyfills & shims (imported for side-effects or at runtime)
        'babel-polyfill',
        'core-js',
        'setimmediate',
        'react-native-url-polyfill',
        'react-native-get-random-values',

        // Used in package.json scripts or CI only
        'concurrently',
        'dotenv',
        'http-server',
        'onchange',
        'cspell',
        'shellcheck',
        'patch-package',
        'peggy',
        'wait-port',
        'diff-so-fancy',
        'tsx',
        'ts-node',
        'tsconfig-paths',

        // Dev tooling
        '@welldone-software/why-did-you-render',
        'react-compiler-healthcheck',
        '@react-navigation/devtools',

        // Vitest mock utility (used in test config)
        '@vitest/mocker',

        // react-native-web (aliased by webpack, not directly imported)
        'react-web-config',

        // Process polyfill for web
        'process',
    ],

    // All rules as warnings so knip never returns a non-zero exit code
    rules: {
        binaries: 'warn',
        classMembers: 'warn',
        dependencies: 'warn',
        devDependencies: 'warn',
        duplicates: 'warn',
        enumMembers: 'warn',
        exports: 'warn',
        files: 'warn',
        nsExports: 'warn',
        nsTypes: 'warn',
        types: 'warn',
        unlisted: 'warn',
        unresolved: 'warn',
    },
};

export default config;
