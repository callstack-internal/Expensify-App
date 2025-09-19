// eslint.config.js
import importAlias from '@dword-design/eslint-plugin-import-alias';
import {fixupPluginRules} from '@eslint/compat';
import js from '@eslint/js';
import {configs as airbnbExtended} from 'eslint-config-airbnb-extended/legacy';
import expensifyPlugin from 'eslint-config-expensify';
import {rules as prettierConfigRules} from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';
import lodashPlugin from 'eslint-plugin-lodash';
import prettierPlugin from 'eslint-plugin-prettier';
import reactCompilerPlugin from 'eslint-plugin-react-compiler';
import testingLibrary from 'eslint-plugin-testing-library';
import youDontNeedLodashUnderscorePlugin from 'eslint-plugin-you-dont-need-lodash-underscore';
import {defineConfig} from 'eslint/config';
import tseslint from 'typescript-eslint';

const restrictedImportPaths = [
    {
        name: 'react-native',
        importNames: [
            'useWindowDimensions',
            'StatusBar',
            'TouchableOpacity',
            'TouchableWithoutFeedback',
            'TouchableNativeFeedback',
            'TouchableHighlight',
            'Pressable',
            'Text',
            'ScrollView',
            'Animated',
            'findNodeHandle',
        ],
        message: [
            '',
            "For 'useWindowDimensions', please use '@src/hooks/useWindowDimensions' instead.",
            "For 'TouchableOpacity', 'TouchableWithoutFeedback', 'TouchableNativeFeedback', 'TouchableHighlight', 'Pressable', please use 'PressableWithFeedback' and/or 'PressableWithoutFeedback' from '@components/Pressable' instead.",
            "For 'StatusBar', please use '@libs/StatusBar' instead.",
            "For 'Text', please use '@components/Text' instead.",
            "For 'ScrollView', please use '@components/ScrollView' instead.",
            "For 'Animated', please use 'Animated' from 'react-native-reanimated' instead.",
        ].join('\n'),
    },
    {
        name: 'react-native-gesture-handler',
        importNames: ['TouchableOpacity', 'TouchableWithoutFeedback', 'TouchableNativeFeedback', 'TouchableHighlight'],
        message: "Please use 'PressableWithFeedback' and/or 'PressableWithoutFeedback' from '@components/Pressable' instead.",
    },
    {
        name: 'awesome-phonenumber',
        importNames: ['parsePhoneNumber'],
        message: "Please use '@libs/PhoneNumber' instead.",
    },
    {
        name: 'react-native-safe-area-context',
        importNames: ['useSafeAreaInsets', 'SafeAreaConsumer', 'SafeAreaInsetsContext'],
        message: "Please use 'useSafeAreaInsets' from '@src/hooks/useSafeAreaInset' and/or 'SafeAreaConsumer' from '@components/SafeAreaConsumer' instead.",
    },
    {
        name: 'react',
        importNames: ['CSSProperties'],
        message: "Please use 'ViewStyle', 'TextStyle', 'ImageStyle' from 'react-native' instead.",
    },
    {
        name: '@styles/index',
        importNames: ['default', 'defaultStyles'],
        message: 'Do not import styles directly. Please use the `useThemeStyles` hook instead.',
    },
    {
        name: '@styles/utils',
        importNames: ['default', 'DefaultStyleUtils'],
        message: 'Do not import StyleUtils directly. Please use the `useStyleUtils` hook instead.',
    },
    {
        name: '@styles/theme',
        importNames: ['default', 'defaultTheme'],

        message: 'Do not import themes directly. Please use the `useTheme` hook instead.',
    },
    {
        name: '@styles/theme/illustrations',
        message: 'Do not import theme illustrations directly. Please use the `useThemeIllustrations` hook instead.',
    },
    {
        name: 'date-fns/locale',
        message: "Do not import 'date-fns/locale' directly. Please use the submodule import instead, like 'date-fns/locale/en-GB'.",
    },
    {
        name: 'expensify-common',
        importNames: ['Device', 'ExpensiMark'],
        message: [
            '',
            "For 'Device', do not import it directly, it's known to make VSCode's IntelliSense crash. Please import the desired module from `expensify-common/dist/Device` instead.",
            "For 'ExpensiMark', please use '@libs/Parser' instead.",
        ].join('\n'),
    },
    {
        name: 'lodash/memoize',
        message: "Please use '@src/libs/memoize' instead.",
    },
    {
        name: 'lodash',
        importNames: ['memoize'],
        message: "Please use '@src/libs/memoize' instead.",
    },
    {
        name: 'lodash/isEqual',
        message: "Please use 'deepEqual' from 'fast-equals' instead.",
    },
    {
        name: 'lodash',
        importNames: ['isEqual'],
        message: "Please use 'deepEqual' from 'fast-equals' instead.",
    },
    {
        name: 'react-native-animatable',
        message: "Please use 'react-native-reanimated' instead.",
    },
    {
        name: 'react-native-onyx',
        importNames: ['useOnyx'],
        message: "Please use '@hooks/useOnyx' instead.",
    },
    {
        name: '@src/utils/findNodeHandle',
        message: "Do not use 'findNodeHandle' as it is no longer supported on web.",
    },
];

const restrictedImportPatterns = [
    {
        group: ['**/assets/animations/**/*.json'],
        message: "Do not import animations directly. Please use the '@components/LottieAnimations' import instead.",
    },
    {
        group: ['@styles/theme/themes/**'],
        message: 'Do not import themes directly. Please use the `useTheme` hook instead.',
    },
    {
        group: ['@styles/utils/**', '!@styles/utils/FontUtils', '!@styles/utils/types'],
        message: 'Do not import style util functions directly. Please use the `useStyleUtils` hook instead.',
    },
    {
        group: ['@styles/theme/illustrations/themes/**'],
        message: 'Do not import theme illustrations directly. Please use the `useThemeIllustrations` hook instead.',
    },
    // Potentially to remove @dword-design/import-alias/prefer-alias rules
    // {group: ['./assets/*'], message: 'Please use @assets/* instead.'},
    // {group: ['./src/components/*'], message: 'Please use @components/* instead.'},
    // {group: ['./src/hooks/*'], message: 'Please use @hooks/* instead.'},
    // {group: ['./src/libs/actions/*'], message: 'Please use @userActions/* instead.'},
    // {group: ['./src/libs/*'], message: 'Please use @libs/* instead.'},
    // {group: ['./src/libs/Navigation/*'], message: 'Please use @navigation/* instead.'},
    // {group: ['./src/pages/*'], message: 'Please use @pages/* instead.'},
    // {group: ['./prompts/*'], message: 'Please use @prompts/* instead.'},
    // {group: ['./src/styles/*'], message: 'Please use @styles/* instead.'},
    // {group: ['./src/*'], message: 'Please use @src/* instead.'},
    // {group: ['./desktop/*'], message: 'Please use @desktop/* instead.'},
    // {group: ['./.github/*'], message: 'Please use @github/* instead.'},
];

const jsConfig = [
    {
        name: 'js/config',
        ...js.configs.recommended,
    },
];

const reactConfig = [...airbnbExtended.react.recommended, ...airbnbExtended.react.hooks];

const typescriptConfig = [...airbnbExtended.react.typescript];

const prettierConfig = [
    {
        name: 'prettier/plugin/config',
        plugins: {
            prettier: prettierPlugin,
        },
    },
    {
        name: 'prettier/config',
        rules: {
            ...prettierConfigRules,
            'prettier/prettier': 'error',
        },
    },
];

export default defineConfig(
    {
        // config with just ignores is the replacement for `.eslintignore`
        ignores: [
            // configs
            '*.config.js',
            '**/.eslintrc.js',
            '**/.eslintrc.changed.js',

            // common ignores
            '**/node_modules/**',
            '**/dist/**',
            'android/**/build/**',
            'docs/vendor/**',
            'docs/assets/**',
            'web/gtm.js',
            '**/.expo/**',

            // project specific
            'src/libs/SearchParser/searchParser.js',
            'src/libs/SearchParser/autocompleteParser.js',
            'help/_scripts/**',
            'modules/ExpensifyNitroUtils/nitrogen/**',
            'Mobile-Expensify/**',
            'vendor',
            'modules/group-ib-fp/**',
            'web/snippets/gib.js',
        ],
    },

    ...jsConfig,
    ...reactConfig,
    ...typescriptConfig,
    tseslint.configs.recommendedTypeChecked,
    importAlias.configs.recommended,
    // Main config for TypeScript, React, Testing Library
    {
        files: ['**/*.{js,jsx,ts,tsx}'],
        plugins: {
            // '@typescript-eslint': tseslint.plugin,
            // react: reactPlugin,
            'testing-library': testingLibrary,
            jsdoc,
            'you-dont-need-lodash-underscore': fixupPluginRules(youDontNeedLodashUnderscorePlugin),
            lodash: fixupPluginRules(lodashPlugin),
            'react-compiler': reactCompilerPlugin,
            // 'react-native': reactNativePlugin,
            expensify: fixupPluginRules(expensifyPlugin),
        },
        // extends: [importPlugin.flatConfigs.recommended, importPlugin.flatConfigs.typescript],
        // extends: ['plugin:lodash/recommended'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                tsconfigRootDir: import.meta.dirname,
                projectService: true,
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                __DEV__: 'readonly',
                jest: 'readonly',
            },
        },
        rules: {
            // TypeScript specific rules
            '@typescript-eslint/prefer-enum-initializers': 'error',
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/no-non-null-assertion': 'error',
            '@typescript-eslint/switch-exhaustiveness-check': 'error',
            '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/no-import-type-side-effects': 'error',
            '@typescript-eslint/array-type': ['error', {default: 'array-simple'}],
            '@typescript-eslint/max-params': ['error', {max: 10}],
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: ['variable', 'property'],
                    format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
                    // This filter excludes variables and properties that start with "private_" to make them valid.
                    //
                    // Examples:
                    // - "private_a" → valid
                    // - "private_test" → valid
                    // - "private_" → not valid
                    filter: {
                        regex: '^private_[a-z][a-zA-Z0-9]*$',
                        match: false,
                    },
                },
                {
                    selector: 'function',
                    format: ['camelCase', 'PascalCase'],
                },
                {
                    selector: ['typeLike', 'enumMember'],
                    format: ['PascalCase'],
                },
                {
                    selector: ['parameter', 'method'],
                    format: ['camelCase', 'PascalCase'],
                    leadingUnderscore: 'allow',
                },
            ],

            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    prefer: 'type-imports',
                    fixStyle: 'separate-type-imports',
                },
            ],
            '@typescript-eslint/consistent-type-exports': [
                'error',
                {
                    fixMixedExportsWithInlineTypeSpecifier: false,
                },
            ],
            '@typescript-eslint/no-use-before-define': ['error', {functions: false}],
            '@typescript-eslint/no-deprecated': 'warn',
            // ESLint core rules
            'es/no-nullish-coalescing-operators': 'off',
            'es/no-optional-chaining': 'off',
            // 'deprecation/deprecation': 'off', => '@typescript-eslint/no-deprecated': 'warn',
            'arrow-body-style': 'off',
            'no-continue': 'off',

            // Import specific rules
            'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
            'import/no-extraneous-dependencies': 'off',

            // Rulesdir specific rules >> eslint-config-expensify not compatible with eslint 9
            // 'rulesdir/no-default-props': 'error',
            // 'rulesdir/prefer-type-fest': 'error',
            // 'rulesdir/no-multiple-onyx-in-file': 'off',
            // 'rulesdir/prefer-underscore-method': 'off',
            // 'rulesdir/prefer-import-module-contents': 'off',
            // 'rulesdir/no-beta-handler': 'error',

            // React and React Native specific rules
            // 'react-native-a11y/has-accessibility-hint': ['off'],
            'react/require-default-props': 'off',
            'react/prop-types': 'off',
            'react/jsx-key': 'error',
            'react/jsx-no-constructed-context-values': 'error',
            // 'react-native-a11y/has-valid-accessibility-descriptors': [
            //     'error',
            //     {
            //         touchables: ['PressableWithoutFeedback', 'PressableWithFeedback'],
            //     },
            // ],
            'react-compiler/react-compiler': 'error',

            // // Disallow usage of certain functions and imports
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'TSEnumDeclaration',
                    message: "Please don't declare enums, use union types instead.",
                },

                // These are the original rules from AirBnB's style guide, modified to allow for...of loops and for...in loops
                {
                    selector: 'LabeledStatement',
                    message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
                },
                {
                    selector: 'WithStatement',
                    message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize. It is also deprecated.',
                },
            ],
            'no-restricted-properties': [
                'error',
                {
                    object: 'Image',
                    property: 'getSize',
                    message: 'Usage of Image.getImage is restricted. Please use the `react-native-image-size`.',
                },
                // Disallow direct HybridAppModule.isHybridApp() usage, because it requires a native call
                // Use CONFIG.IS_HYBRID_APP, which keeps cached value instead
                {
                    object: 'HybridAppModule',
                    property: 'isHybridApp',
                    message: 'Use CONFIG.IS_HYBRID_APP instead.',
                },
                // Prevent direct use of HybridAppModule.closeReactNativeApp().
                // Instead, use the `closeReactNativeApp` action from `@userActions/HybridApp`,
                // which correctly updates `hybridApp.closingReactNativeApp` when closing NewDot
                {
                    object: 'HybridAppModule',
                    property: 'closeReactNativeApp',
                    message: 'Use `closeReactNativeApp` from `@userActions/HybridApp` instead.',
                },
            ],
            'no-restricted-imports': [
                'error',
                {
                    paths: restrictedImportPaths,
                    patterns: restrictedImportPatterns,
                },
            ],
            '@typescript-eslint/no-restricted-types': [
                'error',
                {
                    types: {
                        object: {
                            message: "Use 'Record<string, T>' instead.",
                        },
                    },
                },
            ],
            '@typescript-eslint/no-empty-object-type': 'error',
            '@typescript-eslint/no-unsafe-function-type': 'error',
            '@typescript-eslint/no-wrapper-object-types': 'error',

            // Other rules
            curly: 'error',
            ...youDontNeedLodashUnderscorePlugin.configs['all-warn'].rules,
            'you-dont-need-lodash-underscore/throttle': 'off',
            // The suggested alternative (structuredClone) is not supported in Hermes:https://github.com/facebook/hermes/issues/684
            'you-dont-need-lodash-underscore/clone-deep': 'off',

            'lodash/import-scope': ['error', 'method'],
            'prefer-regex-literals': 'off',
            // 'valid-jsdoc': 'off', -- Removed from eslint, moved to jsdoc plugin
            'jsdoc/no-types': 'error',
            'jsdoc/require-param-type': 'off',
            'jsdoc/require-returns-type': 'off',
            // 'import/no-cycle': 'off', // Temporary OFF for testing, It took ~80% of linting time https://github.com/import-js/eslint-plugin-import/issues/3148
            '@dword-design/import-alias/prefer-alias': [
                'warn',
                {
                    alias: {
                        '@assets': './assets',
                        '@components': './src/components',
                        '@hooks': './src/hooks',
                        // This is needed up here, if not @libs/actions would take the priority
                        '@userActions': './src/libs/actions',
                        '@libs': './src/libs',
                        '@navigation': './src/libs/Navigation',
                        '@pages': './src/pages',
                        '@prompts': './prompts',
                        '@styles': './src/styles',
                        // This path is provide alias for files like `ONYXKEYS` and `CONST`.
                        '@src': './src',
                        '@desktop': './desktop',
                        '@github': './.github',
                    },
                },
            ],
        },
    },
    {
        // disable type-aware linting on JS files
        files: ['**/*.js', '**/*.jsx', '**/*.mjs'],
        extends: [tseslint.configs.disableTypeChecked],
    },
    // overrides: [
    //     // Enforces every Onyx type and its properties to have a comment explaining its purpose.
    {
        files: ['src/types/onyx/**/*.ts'],
        rules: {
            'jsdoc/require-jsdoc': [
                'error',
                {
                    contexts: ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSPropertySignature'],
                },
            ],
        },
    },

    //     // Remove once no JS files are left
    //     {
    //         files: ['*.js', '*.jsx'],
    //         extends: ['plugin:@typescript-eslint/disable-type-checked'],
    //         rules: {
    //             '@typescript-eslint/prefer-nullish-coalescing': 'off',
    //             '@typescript-eslint/no-unsafe-return': 'off',
    //             '@typescript-eslint/unbound-method': 'off',
    //             'jsdoc/no-types': 'off',
    //             'react/jsx-filename-extension': 'off',
    //             'rulesdir/no-default-props': 'off',
    //             'prefer-arrow-callback': 'off',
    //         },
    //     },
    //     {
    //         files: ['en.ts', 'es.ts'],
    //         rules: {
    //             'rulesdir/use-periods-for-error-messages': 'error',
    //         },
    //     },
    //     {
    //         files: ['*.ts', '*.tsx'],
    //         rules: {
    //             'rulesdir/prefer-at': 'error',
    //             'rulesdir/boolean-conditional-rendering': 'error',
    //         },
    //     },
    // ],

    ...prettierConfig,
);
