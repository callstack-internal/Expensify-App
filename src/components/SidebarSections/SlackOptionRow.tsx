import Avatar from '@components/Avatar';
import Icon from '@components/Icon';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';

import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import {useReportAttributesByID} from '@hooks/useReportAttributes';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';

import Navigation from '@libs/Navigation/Navigation';
import {getIcons, isUnread} from '@libs/ReportUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';

import React from 'react';
import {View} from 'react-native';

type SlackOptionRowProps = {
    reportID: string;
    isFocused: boolean;
};

function SlackOptionRow({reportID, isFocused}: SlackOptionRowProps) {
    const styles = useThemeStyles();
    const theme = useTheme();
    const {formatPhoneNumber, translate} = useLocalize();
    const {Pin} = useMemoizedLazyExpensifyIcons(['Pin']);
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const attributes = useReportAttributesByID(reportID);

    if (!report) {
        return null;
    }

    const icon = getIcons(report, formatPhoneNumber, translate).at(0);
    const reportName = attributes?.reportName ?? report.reportName ?? '';
    const brickRoad = attributes?.brickRoadStatus;

    return (
        <PressableWithFeedback
            sentryLabel="SlackOptionRow"
            onPress={() => {
                if (reportID === Navigation.getTopmostReportId()) {
                    return;
                }
                Navigation.navigate(ROUTES.REPORT_WITH_ID.getRoute(reportID, attributes?.actionTargetReportActionID));
            }}
            accessibilityLabel={reportName}
            role={CONST.ROLE.BUTTON}
            style={[styles.flexRow, styles.alignItemsCenter, styles.ph5, styles.pv2, isFocused && styles.sidebarLinkActive]}
        >
            {!!icon && (
                <Avatar
                    source={icon.source}
                    type={icon.type}
                    name={icon.name}
                    avatarID={icon.id}
                    size={CONST.AVATAR_SIZE.SMALL}
                    fallbackIcon={icon.fallbackIcon}
                />
            )}
            <Text
                numberOfLines={1}
                style={[styles.ml3, styles.flex1, isUnread(report, undefined, false) ? styles.sidebarLinkTextBold : styles.sidebarLinkText]}
            >
                {reportName}
            </Text>
            {!!report.isPinned && !brickRoad && (
                <Icon
                    src={Pin}
                    width={16}
                    height={16}
                    fill={theme.icon}
                />
            )}
            {brickRoad === CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR && <View style={[styles.ml2, {width: 8, height: 8, borderRadius: 4, backgroundColor: theme.danger}]} />}
            {brickRoad === CONST.BRICK_ROAD_INDICATOR_STATUS.INFO && <View style={[styles.ml2, {width: 8, height: 8, borderRadius: 4, backgroundColor: theme.success}]} />}
        </PressableWithFeedback>
    );
}

export default SlackOptionRow;
