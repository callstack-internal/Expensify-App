/**
 * @format
 */
import {AppRegistry} from 'react-native';
import {enableLegacyWebImplementation} from 'react-native-gesture-handler';
import App from './src/App';
import Config from './src/CONFIG';
import additionalAppSetup from './src/setup';
import { startProfiling } from 'react-native-release-profiler';

startProfiling();
enableLegacyWebImplementation(true);
AppRegistry.registerComponent(Config.APP_NAME, () => App);
additionalAppSetup();
