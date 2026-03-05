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
import type {Report, ReportNameValuePairs} from '@src/types/onyx';

function hasDraftCommentSelector(draftComment: OnyxEntry<string>): boolean {
    return !!draftComment && !draftComment.match(CONST.REGEX.EMPTY_COMMENT);
}

function privateIsArchivedSelector(reportNameValuePairs: OnyxEntry<ReportNameValuePairs>): string | undefined {
    return reportNameValuePairs?.private_isArchived;
}

function isPinnedSelector(report: OnyxEntry<Report>): boolean {
    return !!report?.isPinned;
}

function GBRIndicator({reportID}: {reportID: string}) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const expensifyIcons = useMemoizedLazyExpensifyIcons(['DotIndicator']);
    const [reportAttributesDerived] = useOnyx(ONYXKEYS.DERIVED.REPORT_ATTRIBUTES, {selector: reportsSelector});
    const brickRoadIndicator = reportAttributesDerived?.[reportID]?.brickRoadStatus;

    if (brickRoadIndicator !== CONST.BRICK_ROAD_INDICATOR_STATUS.INFO) {
        return null;
    }

    return (
        <View style={styles.ml2}>
            <Icon
                testID="GBR Icon"
                src={expensifyIcons.DotIndicator}
                fill={theme.success}
            />
        </View>
    );
}

function DraftIndicator({reportID}: {reportID: string}) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const expensifyIcons = useMemoizedLazyExpensifyIcons(['Pencil']);
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const [hasDraftComment] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_DRAFT_COMMENT}${reportID}`, {selector: hasDraftCommentSelector});
    const [privateIsArchived] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${reportID}`, {selector: privateIsArchivedSelector});

    const isAllowedToComment = canUserPerformWriteAction(report, !!privateIsArchived);

    if (!hasDraftComment || !isAllowedToComment) {
        return null;
    }

    return (
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
    );
}

function PinIndicator({reportID}: {reportID: string}) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const expensifyIcons = useMemoizedLazyExpensifyIcons(['Pin']);
    const [isPinned] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`, {selector: isPinnedSelector});
    const [reportAttributesDerived] = useOnyx(ONYXKEYS.DERIVED.REPORT_ATTRIBUTES, {selector: reportsSelector});
    const brickRoadIndicator = reportAttributesDerived?.[reportID]?.brickRoadStatus;

    if (brickRoadIndicator || !isPinned) {
        return null;
    }

    return (
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
    );
}

type RowIndicatorsProps = {
    reportID: string;
};

function RowIndicators({reportID}: RowIndicatorsProps) {
    const styles = useThemeStyles();

    return (
        <View style={[styles.flexRow, styles.alignItemsCenter]}>
            <GBRIndicator reportID={reportID} />
            <DraftIndicator reportID={reportID} />
            <PinIndicator reportID={reportID} />
        </View>
    );
}

RowIndicators.displayName = 'RowIndicators';

export default RowIndicators;
