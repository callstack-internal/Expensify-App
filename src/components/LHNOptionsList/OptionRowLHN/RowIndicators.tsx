import reportsSelector from '@selectors/Attributes';
import React from 'react';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import Icon from '@components/Icon';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {canUserPerformWriteAction} from '@libs/ReportUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportNameValuePairs} from '@src/types/onyx';

function hasDraftCommentSelector(draftComment: OnyxEntry<string>): boolean {
    return !!draftComment && !draftComment.match(CONST.REGEX.EMPTY_COMMENT);
}

function privateIsArchivedSelector(reportNameValuePairs: OnyxEntry<ReportNameValuePairs>): string | undefined {
    return reportNameValuePairs?.private_isArchived;
}

type RowIndicatorsProps = {
    reportID: string;
};

function RowIndicators({reportID}: RowIndicatorsProps) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const expensifyIcons = useMemoizedLazyExpensifyIcons(['Pencil', 'DotIndicator', 'Pin']);

    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const [reportAttributesDerived] = useOnyx(ONYXKEYS.DERIVED.REPORT_ATTRIBUTES, {selector: reportsSelector});
    const [hasDraftComment] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_DRAFT_COMMENT}${reportID}`, {selector: hasDraftCommentSelector});
    const [privateIsArchived] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${reportID}`, {selector: privateIsArchivedSelector});

    const brickRoadIndicator = reportAttributesDerived?.[reportID]?.brickRoadStatus;
    const isPinned = report?.isPinned;
    const isAllowedToComment = canUserPerformWriteAction(report, !!privateIsArchived);

    return (
        <View style={[styles.flexRow, styles.alignItemsCenter]}>
            {brickRoadIndicator === CONST.BRICK_ROAD_INDICATOR_STATUS.INFO && (
                <View style={styles.ml2}>
                    <Icon
                        testID="GBR Icon"
                        src={expensifyIcons.DotIndicator}
                        fill={theme.success}
                    />
                </View>
            )}
            {!!hasDraftComment && !!isAllowedToComment && (
                <View
                    style={styles.ml2}
                    accessibilityLabel={translate('sidebarScreen.draftedMessage')}
                >
                    <Icon
                        testID="Pencil Icon"
                        fill={theme.icon}
                        src={expensifyIcons.Pencil}
                    />
                </View>
            )}
            {!brickRoadIndicator && !!isPinned && (
                <View
                    style={styles.ml2}
                    accessibilityLabel={translate('sidebarScreen.chatPinned')}
                >
                    <Icon
                        testID="Pin Icon"
                        fill={theme.icon}
                        src={expensifyIcons.Pin}
                    />
                </View>
            )}
        </View>
    );
}

RowIndicators.displayName = 'RowIndicators';

export default RowIndicators;
