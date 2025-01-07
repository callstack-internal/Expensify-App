import {UnistylesRegistry} from 'react-native-unistyles';
import darkTheme from './styles/theme/themes/dark';
import lightTheme from './styles/theme/themes/light';

// type Theme = {
//     colors: {
//         typography: string;
//         background: string;
//     };
//     margins: {
//         sm: number;
//         md: number;
//         lg: number;
//         xl: number;
//     };
// };

// const lightTheme: Theme = {
//     colors: {
//         typography: '#000000',
//         background: '#ffffff',
//     },
//     margins: {
//         sm: 2,
//         md: 4,
//         lg: 8,
//         xl: 12,
//     },
// };

// const darkTheme: Theme = {
//     colors: {
//         typography: '#ffffff',
//         background: '#000000',
//     },
//     margins: {
//         sm: 2,
//         md: 4,
//         lg: 8,
//         xl: 12,
//     },
// };

// type Theme = typeof lightTheme;

// if you defined themes
type AppThemes = {
    light: typeof lightTheme;
    dark: typeof darkTheme;
};

// override library types
declare module 'react-native-unistyles' {
    // eslint-disable-next-line rulesdir/no-inline-named-export, @typescript-eslint/ban-types
    export type UnistylesThemes = {} & AppThemes;
}

UnistylesRegistry.addThemes({
    light: lightTheme,
    dark: darkTheme,
    // register other themes with unique names
}).addConfig({
    // you can pass here optional config described below
    adaptiveThemes: true,
});

// export {lightTheme, darkTheme};

// export type {Theme};
