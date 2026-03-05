import React from 'react';
import {View} from 'react-native';
import Icon from '@components/Icon';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import type {BrickRoad} from '@libs/WorkspacesSettingsUtils';
import CONST from '@src/CONST';

type RowRBRIndicatorProps = {
    brickRoadIndicator?: BrickRoad;
};

function RowRBRIndicator({brickRoadIndicator}: RowRBRIndicatorProps) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const expensifyIcons = useMemoizedLazyExpensifyIcons(['DotIndicator']);

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
