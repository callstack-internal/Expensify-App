import {useFocusEffect, useRoute} from '@react-navigation/native';
import React, {useCallback, useEffect, useRef} from 'react';
import Button from '@components/Button';
import {useModal, usePopoverMenu} from '@components/Modal/Global';
import type {SearchQueryJSON} from '@components/Search/types';
import useSafeAreaPaddings from '@hooks/useSafeAreaPaddings';
import useSearchTypeMenu from '@hooks/useSearchTypeMenu';
import useThemeStyles from '@hooks/useThemeStyles';
import * as Expensicons from '@src/components/Icon/Expensicons';

type SearchTypeMenuNarrowProps = {
    queryJSON: SearchQueryJSON;
};

function SearchTypeMenuPopover({queryJSON}: SearchTypeMenuNarrowProps) {
    const styles = useThemeStyles();
    const route = useRoute();
    const {delayPopoverMenuFirstRender, allMenuItems, windowHeight} = useSearchTypeMenu(queryJSON, route.key);
    const {showPopoverMenu} = usePopoverMenu();
    const {closeModalById} = useModal();

    const buttonRef = useRef<HTMLDivElement>(null);
    const {unmodifiedPaddings} = useSafeAreaPaddings();

    const openMenu = useCallback(async () => {
        if (delayPopoverMenuFirstRender) {
            return;
        }
        await showPopoverMenu({
            menuItems: allMenuItems,
            anchorPosition: styles.createMenuPositionSidebar(windowHeight),
            anchorRef: buttonRef,
            shouldUseScrollView: true,
            shouldUseModalPaddingStyle: false,
            innerContainerStyle: {paddingBottom: unmodifiedPaddings.bottom},
            shouldAvoidSafariException: true,
            scrollContainerStyle: styles.pv0,
            id: `popover:${route.key}`,
        });
    }, [delayPopoverMenuFirstRender, showPopoverMenu, allMenuItems, styles, windowHeight, buttonRef, unmodifiedPaddings.bottom, route.key]);

    useFocusEffect(
        useCallback(() => {
            return () => {
                closeModalById(`popover:${route.key}`);
            };
        }, [closeModalById, route.key]),
    );

    return (
        <Button
            icon={Expensicons.Menu}
            onPress={openMenu}
        />
    );
}

SearchTypeMenuPopover.displayName = 'SearchTypeMenuPopover';

export default SearchTypeMenuPopover;
