import React from 'react';
import {View} from 'react-native';
import Badge from '@components/Badge';
import Icon from '@components/Icon';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import {useReportAttributesByID} from '@hooks/useReportAttributes';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';

type RowRBRIndicatorProps = {
    reportID: string;
};

function RowRBRIndicator({reportID}: RowRBRIndicatorProps) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const expensifyIcons = useMemoizedLazyExpensifyIcons(['DotIndicator']);

    const reportAttributes = useReportAttributesByID(reportID);
    const brickRoadIndicator = reportAttributes?.brickRoadStatus;
    const actionBadge = reportAttributes?.actionBadge;

    if (brickRoadIndicator !== CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR) {
        return null;
    }

    const actionBadgeText = actionBadge ? translate(`common.actionBadge.${actionBadge}`) : '';

    return (
        <View style={[styles.alignItemsCenter, styles.justifyContentCenter]}>
            {actionBadgeText ? (
                <Badge
                    text={actionBadgeText}
                    error
                    isStrong
                />
            ) : (
                <Icon
                    testID="RBR Icon"
                    src={expensifyIcons.DotIndicator}
                    fill={theme.danger}
                />
            )}
        </View>
    );
}

RowRBRIndicator.displayName = 'RowRBRIndicator';

export default RowRBRIndicator;
