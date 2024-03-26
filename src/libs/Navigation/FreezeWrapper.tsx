import {useIsFocused, useNavigation, useRoute} from '@react-navigation/native';
import React, {useEffect, useRef, useState} from 'react';
import {Freeze} from 'react-freeze';
import NAVIGATORS from '@src/NAVIGATORS';
import type ChildrenProps from '@src/types/utils/ChildrenProps';

type FreezeWrapperProps = ChildrenProps & {
    /** Prop to disable freeze */
    keepVisible?: boolean;
    /** Prop to enable freeze */
    shouldFreeze?: boolean;
};

function FreezeWrapper({keepVisible = false, shouldFreeze = false, children}: FreezeWrapperProps) {
    const [isScreenBlurred, setIsScreenBlurred] = useState(false);
    // we need to know the screen index to determine if the screen can be frozen
    const screenIndexRef = useRef<number | null>(null);
    const isFocused = useIsFocused();
    const navigation = useNavigation();
    const currentRoute = useRoute();

    useEffect(() => {
        const index = navigation.getState()?.routes.findIndex((route) => route.key === currentRoute.key) ?? 0;
        screenIndexRef.current = index;

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const unsubscribe = navigation.addListener('state', () => {
            const currentStackIndex = navigation.getState()?.index ?? 0;
            const currentRouteIndex = screenIndexRef.current ?? 0;
            const currentNavigatorRouteIndex = navigation.getState()?.routes.findIndex((route) => route.name === NAVIGATORS.BOTTOM_TAB_NAVIGATOR) ?? 0;

            if (currentStackIndex - currentRouteIndex >= 1 || (shouldFreeze && currentStackIndex - currentNavigatorRouteIndex >= 1)) {
                setIsScreenBlurred(true);
            } else {
                setIsScreenBlurred(false);
            }
        });

        return () => unsubscribe();
    }, [navigation, shouldFreeze]);

    return <Freeze freeze={!isFocused && isScreenBlurred && !keepVisible}>{children}</Freeze>;
}

FreezeWrapper.displayName = 'FreezeWrapper';

export default FreezeWrapper;
