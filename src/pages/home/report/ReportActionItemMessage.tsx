import type {ReactElement} from 'react';
import React from 'react';
import type {StyleProp, TextStyle, ViewStyle} from 'react-native';
import {View} from 'react-native';
import Button from '@components/Button';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useThemeStyles from '@hooks/useThemeStyles';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import Navigation from '@libs/Navigation/Navigation';
import {
    getLinkedTransactionID,
    getMemberChangeMessageFragment,
    getOriginalMessage,
    getReportActionMessage,
    getReportActionMessageFragments,
    getUpdateRoomDescriptionFragment,
    isAddCommentAction,
    isApprovedOrSubmittedReportAction as isApprovedOrSubmittedReportActionUtils,
    isMemberChangeAction,
    isMoneyRequestAction,
    isThreadParentMessage,
} from '@libs/ReportActionsUtils';
import {getIOUReportActionDisplayMessage, getReportName, hasMissingInvoiceBankAccount, isSettled} from '@libs/ReportUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {ReportAction} from '@src/types/onyx';
import TextCommentFragment from './comment/TextCommentFragment';
import ReportActionItemFragment from './ReportActionItemFragment';

type ReportActionItemMessageProps = {
    /** The report action */
    action: ReportAction;

    /** Should the comment have the appearance of being grouped with the previous comment? */
    displayAsGroup: boolean;

    /** Additional styles to add after local styles. */
    style?: StyleProp<ViewStyle & TextStyle>;

    /** Whether or not the message is hidden by moderation */
    isHidden?: boolean;

    /** The ID of the report */
    reportID: string | undefined;
};

function ReportActionItemMessage({action, displayAsGroup, reportID, style, isHidden = false}: ReportActionItemMessageProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`, {canBeMissing: true});
    const [transaction] = useOnyx(`${ONYXKEYS.COLLECTION.TRANSACTION}${getNonEmptyStringOnyxID(getLinkedTransactionID(action))}`, {canBeMissing: true});

    const fragments = getReportActionMessageFragments(action);
    const isIOUReport = isMoneyRequestAction(action);

    if (isMemberChangeAction(action)) {
        const fragment = getMemberChangeMessageFragment(action, getReportName);

        return (
            <View style={[styles.chatItemMessage, style]}>
                <TextCommentFragment
                    fragment={fragment}
                    displayAsGroup={displayAsGroup}
                    style={style}
                    source=""
                    styleAsDeleted={false}
                />
            </View>
        );
    }

    if (action.actionName === CONST.REPORT.ACTIONS.TYPE.ROOM_CHANGE_LOG.UPDATE_ROOM_DESCRIPTION) {
        const fragment = getUpdateRoomDescriptionFragment(action);
        return (
            <View style={[styles.chatItemMessage, style]}>
                <TextCommentFragment
                    fragment={fragment}
                    displayAsGroup={displayAsGroup}
                    style={style}
                    source=""
                    styleAsDeleted={false}
                />
            </View>
        );
    }

    let iouMessage: string | undefined;
    if (isIOUReport) {
        const originalMessage = action.actionName === CONST.REPORT.ACTIONS.TYPE.IOU ? getOriginalMessage(action) : null;
        const iouReportID = originalMessage?.IOUReportID;
        if (iouReportID) {
            iouMessage = getIOUReportActionDisplayMessage(action, transaction);
        }
    }

    const isApprovedOrSubmittedReportAction = isApprovedOrSubmittedReportActionUtils(action);

    const isHoldReportAction = [CONST.REPORT.ACTIONS.TYPE.HOLD, CONST.REPORT.ACTIONS.TYPE.UNHOLD].some((type) => type === action.actionName);

    /**
     * Get the ReportActionItemFragments
     * @param shouldWrapInText determines whether the fragments are wrapped in a Text component
     * @returns report action item fragments
     */
    const renderReportActionItemFragments = (shouldWrapInText: boolean): ReactElement | ReactElement[] => {
        const reportActionItemFragments = fragments.map((fragment, index) => (
            <ReportActionItemFragment
                /* eslint-disable-next-line react/no-array-index-key */
                key={`actionFragment-${action.reportActionID}-${index}`}
                reportActionID={action.reportActionID}
                fragment={fragment}
                iouMessage={iouMessage}
                isThreadParentMessage={isThreadParentMessage(action, reportID)}
                pendingAction={action.pendingAction}
                actionName={action.actionName}
                source={isAddCommentAction(action) ? getOriginalMessage(action)?.source : ''}
                accountID={action.actorAccountID ?? CONST.DEFAULT_NUMBER_ID}
                style={style}
                displayAsGroup={displayAsGroup}
                isApprovedOrSubmittedReportAction={isApprovedOrSubmittedReportAction}
                isHoldReportAction={isHoldReportAction}
                // Since system messages from Old Dot begin with the person who performed the action,
                // the first fragment will contain the person's display name and their email. We'll use this
                // to decide if the fragment should be from left to right for RTL display names e.g. Arabic for proper
                // formatting.
                isFragmentContainingDisplayName={index === 0}
                moderationDecision={getReportActionMessage(action)?.moderationDecision?.decision}
            />
        ));

        // Approving or submitting reports in oldDot results in system messages made up of multiple fragments of `TEXT` type
        // which we need to wrap in `<Text>` to prevent them rendering on separate lines.
        return shouldWrapInText ? <Text style={styles.ltr}>{reportActionItemFragments}</Text> : reportActionItemFragments;
    };

    const openWorkspaceInvoicesPage = () => {
        const policyID = report?.policyID;

        if (!policyID) {
            return;
        }

        Navigation.navigate(ROUTES.WORKSPACE_INVOICES.getRoute(policyID));
    };

    const shouldShowAddBankAccountButton = action.actionName === CONST.REPORT.ACTIONS.TYPE.IOU && hasMissingInvoiceBankAccount(reportID) && !isSettled(reportID);

    return (
        <View style={[styles.chatItemMessage, style]}>
            {!isHidden ? (
                <>
                    {renderReportActionItemFragments(isApprovedOrSubmittedReportAction)}
                    {shouldShowAddBankAccountButton && (
                        <Button
                            style={[styles.mt2, styles.alignSelfStart]}
                            success
                            text={translate('bankAccount.addBankAccount')}
                            onPress={openWorkspaceInvoicesPage}
                        />
                    )}
                </>
            ) : (
                <Text style={[styles.textLabelSupporting, styles.lh20]}>{translate('moderation.flaggedContent')}</Text>
            )}
        </View>
    );
}

ReportActionItemMessage.displayName = 'ReportActionItemMessage';

export default ReportActionItemMessage;
