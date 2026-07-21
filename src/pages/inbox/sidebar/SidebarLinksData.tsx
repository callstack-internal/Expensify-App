import {useIsFocused} from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import React from 'react';
import {View} from 'react-native';
import SidebarSectionsList from '@components/SidebarSections/SidebarSectionsList';
import useInboxTabSpanLifecycle from '@hooks/useInboxTabSpanLifecycle';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';

function SidebarLinksData() {
    const isFocused = useIsFocused();
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const onLayout = useInboxTabSpanLifecycle();

    return (
        <View
            accessibilityElementsHidden={!isFocused}
            collapsable={false}
            accessibilityLabel={translate('sidebarScreen.listOfChats')}
            style={[styles.flex1, styles.h100]}
            onLayout={onLayout}
        >
            <SidebarSectionsList />
        </View>
    );
}

const WrappedSidebarLinksData = Sentry.withProfiler(SidebarLinksData);

export default WrappedSidebarLinksData;
