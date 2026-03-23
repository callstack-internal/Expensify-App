import React from 'react';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import interceptAnonymousUser from '@libs/interceptAnonymousUser';
import Navigation from '@libs/Navigation/Navigation';
import FABFocusableMenuItem from '@pages/inbox/sidebar/FABPopoverContent/FABFocusableMenuItem';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';

const ITEM_ID = CONST.FAB_MENU_ITEM_IDS.NEW_CHAT;

function OnyxPlaygroundMenuItem() {
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const icons = useMemoizedLazyExpensifyIcons(['Bolt'] as const);

    return (
        <FABFocusableMenuItem
            itemId={ITEM_ID}
            pressableTestID={CONST.SENTRY_LABEL.FAB_MENU.START_CHAT}
            icon={icons.Bolt}
            title="Onyx Playground"
            onPress={() => interceptAnonymousUser(() => Navigation.navigate(ROUTES.ONYX_PLAYGROUND))}
            shouldCallAfterModalHide={shouldUseNarrowLayout}
        />
    );
}

export default OnyxPlaygroundMenuItem;
