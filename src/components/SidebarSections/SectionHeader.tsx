import Icon from '@components/Icon';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';

import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import {useSidebarSectionsActions} from '@hooks/useSidebarSections';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';

import type {SidebarSection, SidebarSectionKey} from '@libs/SidebarSectionsUtils';

import CONST from '@src/CONST';

import React from 'react';

const SECTION_LABELS: Record<SidebarSectionKey, string> = {
    pinned: 'Pinned & Attention',
    errors: 'Needs attention',
    drafts: 'Drafts',
    channels: 'Channels',
    dms: 'Direct messages',
    archived: 'Archived',
};

type SectionHeaderProps = {
    section: SidebarSection;
};

function SectionHeader({section}: SectionHeaderProps) {
    const styles = useThemeStyles();
    const theme = useTheme();
    const {toggleSection} = useSidebarSectionsActions();
    const {DownArrow, ArrowRight} = useMemoizedLazyExpensifyIcons(['DownArrow', 'ArrowRight']);

    return (
        <PressableWithFeedback
            sentryLabel="SidebarSectionHeader"
            onPress={() => toggleSection(section.key)}
            accessibilityLabel={SECTION_LABELS[section.key]}
            role={CONST.ROLE.BUTTON}
            style={[styles.flexRow, styles.alignItemsCenter, styles.ph5, styles.pv2, styles.mt2]}
        >
            <Icon
                src={section.isCollapsed ? ArrowRight : DownArrow}
                width={12}
                height={12}
                fill={theme.icon}
            />
            <Text style={[styles.ml2, styles.textLabelSupporting, styles.textStrong]}>{SECTION_LABELS[section.key]}</Text>
            {section.isCollapsed && section.unreadCount > 0 && <Text style={[styles.ml2, styles.textLabelSupporting]}>{section.unreadCount}</Text>}
        </PressableWithFeedback>
    );
}

export default SectionHeader;
