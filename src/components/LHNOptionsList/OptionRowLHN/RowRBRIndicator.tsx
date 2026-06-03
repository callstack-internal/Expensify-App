import reportsSelector from '@selectors/Attributes';
import React from 'react';
import {View} from 'react-native';
import Icon from '@components/Icon';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useOnyx from '@hooks/useOnyx';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

type RowRBRIndicatorProps = {
    reportID: string;
};

function RowRBRIndicator({reportID}: RowRBRIndicatorProps) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const expensifyIcons = useMemoizedLazyExpensifyIcons(['DotIndicator']);

    const [reportAttributesDerived] = useOnyx(ONYXKEYS.DERIVED.REPORT_ATTRIBUTES, {selector: reportsSelector});
    const brickRoadIndicator = reportAttributesDerived?.[reportID]?.brickRoadStatus;

    if (brickRoadIndicator !== CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR) {
        return null;
    }

    return (
        <View style={[styles.alignItemsCenter, styles.justifyContentCenter]}>
            <Icon
                testID="RBR Icon"
                src={expensifyIcons.DotIndicator}
                fill={theme.danger}
            />
        </View>
    );
}

RowRBRIndicator.displayName = 'RowRBRIndicator';

export default RowRBRIndicator;
