import * as Repack from '@callstack/repack';
import {ExpoModulesPlugin} from '@callstack/repack-plugin-expo-modules';
import {RsdoctorRspackPlugin} from '@rsdoctor/rspack-plugin';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Rspack configuration enhanced with Re.Pack defaults for React Native.
 * Used for native JS bundling when `USE_REPACK=true` (see rock.config.mjs).
 *
 * Learn about Rspack configuration: https://rspack.dev/config/
 * Learn about Re.Pack configuration: https://re-pack.dev/docs/guides/configuration
 *
 * Note on transforms: JS/TS is compiled by `@callstack/repack/babel-swc-loader`,
 * which applies the `@callstack/repack` branch of babel.config.js. That branch
 * runs React Compiler, Fullstory, and `react-native-worklets/plugin` (Reanimated 4),
 * so no separate Reanimated bundler plugin is required here.
 */
export default Repack.defineRspackConfig({
    context: __dirname,
    entry: './index.js',
    experiments: {
        cache: {
            type: 'persistent',
        },
    },
    devServer: {
        // keep using `/.expo/.virtual-metro-entry` as entrypoint
        proxy: [
            {
                context: ['/.expo/.virtual-metro-entry'],
                pathRewrite: {'^/.expo/.virtual-metro-entry': '/index'},
            },
        ],
    },
    resolve: {
        ...Repack.getResolveOptions({enablePackageExports: true}),
        // Resolve path aliases (`@src`, `@components`, …) from tsconfig,
        // replacing babel-plugin-module-resolver (omitted from the repack babel branch).
        tsConfig: {
            configFile: path.resolve(__dirname, './tsconfig.json'),
            references: 'auto',
        },
    },
    module: {
        parser: {
            javascript: {
                // Bundle dynamic imports into the main bundle (no async chunks on native).
                dynamicImportMode: 'eager',
            },
        },
        rules: [
            {
                test: /\.[cm]?[jt]sx?$/,
                type: 'javascript/auto',
                use: {
                    loader: '@callstack/repack/babel-swc-loader',
                    parallel: true,
                    options: {},
                },
            },
            ...Repack.getAssetTransformRules(),
            {
                test: /\.lottie$/,
                use: '@callstack/repack/assets-loader',
            },
        ],
    },
    plugins: [new Repack.RepackPlugin(), new ExpoModulesPlugin(), process.env.RSDOCTOR && new RsdoctorRspackPlugin()].filter(Boolean),
    ignoreWarnings: [
        /Module not found: Can't resolve '@react-native-masked-view\/masked-view'/,
        /Module not found: Can't resolve 'react-native-worklets-core'/,
        /Module not found: Can't resolve '@shopify\/react-native-skia'/,
        /'`setUpTests` is available only in Jest environment\.'/,
    ],
});
