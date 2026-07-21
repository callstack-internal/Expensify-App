import {FlashList} from '@shopify/flash-list';
import React from 'react';
import {View} from 'react-native';
import LHNEmptyState from '@components/LHNOptionsList/LHNEmptyState';
import {useSidebarSectionsState} from '@hooks/useSidebarSections';
import useThemeStyles from '@hooks/useThemeStyles';
import type {SidebarSection} from '@libs/SidebarSectionsUtils';
import SectionHeader from './SectionHeader';
import SlackOptionRow from './SlackOptionRow';

type SidebarListItem = {type: 'header'; section: SidebarSection} | {type: 'row'; reportID: string};

function SidebarSectionsList() {
    const styles = useThemeStyles();
    const {sections, currentReportID} = useSidebarSectionsState();

    const items: SidebarListItem[] = [];
    for (const section of sections) {
        if (section.count === 0) {
            continue;
        }
        items.push({type: 'header', section});
        if (!section.isCollapsed) {
            for (const reportID of section.reportIDs) {
                items.push({type: 'row', reportID});
            }
        }
    }

    if (items.length === 0) {
        return (
            <View style={[styles.flex1, styles.emptyLHNWrapper]}>
                <LHNEmptyState />
            </View>
        );
    }

    return (
        <FlashList
            data={items}
            testID="sidebar-sections-list"
            keyExtractor={(item) => (item.type === 'header' ? `header_${item.section.key}` : `report_${item.reportID}`)}
            getItemType={(item) => item.type}
            renderItem={({item}) =>
                item.type === 'header' ? (
                    <SectionHeader section={item.section} />
                ) : (
                    <SlackOptionRow
                        reportID={item.reportID}
                        isFocused={item.reportID === currentReportID}
                    />
                )
            }
            showsVerticalScrollIndicator={false}
        />
    );
}

export default SidebarSectionsList;
