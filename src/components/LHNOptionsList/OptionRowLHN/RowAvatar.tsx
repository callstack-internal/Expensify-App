import React from 'react';
import type {ViewStyle} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import LHNAvatar from '@components/LHNOptionsList/LHNAvatar';
import {useLHNListContext} from '@components/LHNOptionsList/LHNListContext';
import {usePersonalDetails} from '@components/OnyxListItemProvider';
import {useCurrentReportIDState} from '@hooks/useCurrentReportID';
import useOnyx from '@hooks/useOnyx';
import useParentReportAction from '@hooks/useParentReportAction';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {getDelegateAccountIDFromReportAction} from '@libs/ReportActionsUtils';
import {isChatThread, isExpenseRequest, isTaskReport, isTripRoom, isWorkspaceTaskReport, shouldReportShowSubscript} from '@libs/ReportUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Policy, ReportNameValuePairs} from '@src/types/onyx';
import type {Icon} from '@src/types/onyx/OnyxCommon';

type RowAvatarProps = {
    reportID: string;
    hovered: boolean;
    icons: Icon[];
};

function privateIsArchivedSelector(reportNameValuePairs: OnyxEntry<ReportNameValuePairs>): string | undefined {
    return reportNameValuePairs?.private_isArchived;
}

function policyTypeSelector(policy: OnyxEntry<Policy>): string | undefined {
    return policy?.type;
}

function RowAvatar({reportID, hovered, icons: optionIcons}: RowAvatarProps) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const personalDetails = usePersonalDetails();
    const {optionMode, isOptionFocusEnabled} = useLHNListContext();
    const {currentReportID} = useCurrentReportIDState();
    const isOptionFocused = isOptionFocusEnabled && currentReportID === reportID;

    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const [privateIsArchived] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${reportID}`, {selector: privateIsArchivedSelector});
    const [policyType] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`, {selector: policyTypeSelector});

    const parentReportAction = useParentReportAction(report);

    if (!optionIcons.length) {
        return null;
    }

    const isInFocusMode = optionMode === CONST.OPTION_MODE.COMPACT;
    const size = isInFocusMode ? CONST.AVATAR_SIZE.SMALL : CONST.AVATAR_SIZE.DEFAULT;
    const isReportArchived = !!privateIsArchived;
    const isTask = isTaskReport(report);

    // shouldShowSubscript computation (matches SidebarUtils logic)
    const rawShouldShowSubscript = shouldReportShowSubscript(report, isReportArchived);
    const isWorkspaceExpenseRequest = isExpenseRequest(report) && !!policyType && policyType !== CONST.POLICY.TYPE.PERSONAL;
    const threadSuppression = isChatThread(report) && !isTripRoom(report) && !isWorkspaceExpenseRequest;
    const taskParentAction = isTask && !report?.chatReportID ? undefined : parentReportAction;
    const isReportPreviewOrNoAction = !taskParentAction || taskParentAction?.actionName === CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW;
    const taskSuppression = isTask && !(isWorkspaceTaskReport(report) && isReportPreviewOrNoAction);
    const shouldShowSubscript = rawShouldShowSubscript && !threadSuppression && !taskSuppression;

    // Delegate avatar logic
    const delegateAccountID = getDelegateAccountIDFromReportAction(parentReportAction);
    const skipDelegate = report?.type === CONST.REPORT.TYPE.INVOICE || (isTask && !report?.chatReportID);

    const icons = (() => {
        let result = optionIcons;
        if (!skipDelegate && delegateAccountID && personalDetails && result.length > 0) {
            const delegateDetails = personalDetails[delegateAccountID];
            if (delegateDetails) {
                const updatedIcons = [...result];
                const firstIcon = updatedIcons.at(0);
                if (firstIcon) {
                    updatedIcons[0] = {
                        ...firstIcon,
                        source: delegateDetails.avatar ?? '',
                        name: delegateDetails.displayName ?? '',
                        id: delegateAccountID,
                    };
                }
                result = updatedIcons;
            }
        }
        return result;
    })();

    const delegateTooltipAccountID = (() => {
        if (!skipDelegate && delegateAccountID && personalDetails?.[delegateAccountID] && optionIcons.length) {
            return Number(optionIcons.at(0)?.id ?? CONST.DEFAULT_NUMBER_ID);
        }
        return undefined;
    })();

    // Compute hover-dependent colors
    const hoveredBackgroundColor = !!styles.sidebarLinkHover && 'backgroundColor' in styles.sidebarLinkHover ? styles.sidebarLinkHover.backgroundColor : theme.sidebar;
    const focusedBackgroundColor = styles.sidebarLinkActive.backgroundColor;
    const baseSubscriptColor = isOptionFocused ? focusedBackgroundColor : theme.sidebar;
    const subscriptAvatarBorderColor = hovered && !isOptionFocused ? hoveredBackgroundColor : baseSubscriptColor;

    let secondaryAvatarBackgroundColor = theme.sidebar;
    if (isOptionFocused) {
        secondaryAvatarBackgroundColor = focusedBackgroundColor;
    } else if (hovered) {
        secondaryAvatarBackgroundColor = hoveredBackgroundColor;
    }

    const singleAvatarContainerStyle: ViewStyle[] = [styles.actionAvatar, styles.mr3];

    return (
        <LHNAvatar
            icons={icons}
            shouldShowSubscript={shouldShowSubscript}
            size={size}
            subscriptAvatarBorderColor={subscriptAvatarBorderColor}
            useMidSubscriptSize={isInFocusMode}
            secondaryAvatarBackgroundColor={secondaryAvatarBackgroundColor}
            singleAvatarContainerStyle={singleAvatarContainerStyle}
            shouldShowTooltip={!privateIsArchived}
            delegateAccountID={skipDelegate ? undefined : delegateAccountID}
            delegateTooltipAccountID={delegateTooltipAccountID}
        />
    );
}

export default RowAvatar;
