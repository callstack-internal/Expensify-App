import {useContext} from 'react';
import {useStyles} from 'react-native-unistyles';
import stylesheet from '@styles/index';
import ThemeStylesContext from '@styles/theme/context/ThemeStylesContext';

function useThemeStyles() {
    const themeStylesContext = useContext(ThemeStylesContext);
    const {styles} = useStyles(stylesheet);

    if (!themeStylesContext) {
        throw new Error('ThemeStylesContext was null! Are you sure that you wrapped the component under a <ThemeStylesProvider>?');
    }

    return styles;
}

export default useThemeStyles;
