import lodashIsEqual from 'lodash/isEqual';
import React, {memo} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import RenderHTML from '@components/RenderHTML';
import useLocalize from '@hooks/useLocalize';
import * as ReportActionsUtils from '@libs/ReportActionsUtils';
import * as ReportUtils from '@libs/ReportUtils';
import type * as ReportActionContextMenu from '@pages/home/report/ContextMenu/ReportActionContextMenu';
import ReportActionItemBasicMessage from '@pages/home/report/ReportActionItemBasicMessage';
import CONST from '@src/CONST';
import type * as OnyxTypes from '@src/types/onyx';
import {basicMessageFactory, getFactoryType, messageFactory} from './reportActionMessageFactory';

type ReportActionMessageProps = {
    /** Report for this action */
    report: OnyxEntry<OnyxTypes.Report>;

    /** The transaction thread report associated with the report for this action, if any */
    transactionThreadReport?: OnyxEntry<OnyxTypes.Report>;

    /** Array of report actions for the report for this action */
    // eslint-disable-next-line react/no-unused-prop-types
    reportActions: OnyxTypes.ReportAction[];

    /** Report action belonging to the report's parent */
    parentReportAction: OnyxEntry<OnyxTypes.ReportAction>;

    /** The transaction thread report's parentReportAction */
    /** It's used by withOnyx HOC */
    // eslint-disable-next-line react/no-unused-prop-types
    parentReportActionForTransactionThread?: OnyxEntry<OnyxTypes.ReportAction>;

    /** All the data of the action item */
    action: OnyxTypes.ReportAction;

    /** Should the comment have the appearance of being grouped with the previous comment? */
    displayAsGroup: boolean;

    /** Is this the most recent IOU Action? */
    isMostRecentIOUReportAction: boolean;

    /** Should we display the new marker on top of the comment? */
    shouldDisplayNewMarker: boolean;

    /** Determines if the avatar is displayed as a subscript (positioned lower than normal) */
    shouldShowSubscriptAvatar?: boolean;

    /** Position index of the report action in the overall report FlatList view */
    index: number;

    /** Flag to show, hide the thread divider line */
    shouldHideThreadDividerLine?: boolean;

    linkedReportActionID?: string;

    /** Callback to be called on onPress */
    onPress?: () => void;

    /** If this is the first visible report action */
    isFirstVisibleReportAction: boolean;

    /** IF the thread divider line will be used */
    shouldUseThreadDividerLine?: boolean;

    hideThreadReplies?: boolean;

    /** Whether context menu should be displayed */
    shouldDisplayContextMenu?: boolean;

    isHovered?: boolean;

    reportID: string;

    chatReportID?: string;

    requestReportID?: string;

    contextMenuAnchor?: ReportActionContextMenu.ContextMenuAnchor;

    checkIfContextMenuActive?: (() => void) | undefined;

    style?: StyleProp<ViewStyle>;

    onPaymentOptionsShow?: () => void;

    onPaymentOptionsHide?: () => void;

    policyID?: string;
};

function ReportActionMessage(props: ReportActionMessageProps) {
    console.log('ReportActionMessage: ', props);
    const {translate} = useLocalize();
    const {action, report} = props;
    const componentType = getFactoryType(action);
    const originalMessage = ReportActionsUtils.getOriginalMessage(action);
    const isMoneyRequestAction = ReportActionsUtils.isMoneyRequestAction(action);
    const shouldRenderMoneyRequestAction =
        originalMessage?.type === CONST.IOU.REPORT_ACTION_TYPE.CREATE ||
        originalMessage?.type === CONST.IOU.REPORT_ACTION_TYPE.SPLIT ||
        originalMessage?.type === CONST.IOU.REPORT_ACTION_TYPE.TRACK;
    const isClosedReportPreview = action.actionName === CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW && ReportUtils.isClosedExpenseReportWithNoExpenses(props.report);
    const MessageComponent = messageFactory[componentType];
    if (!MessageComponent) {
        const messageFactoryItem = basicMessageFactory[action.actionName];
        if (messageFactoryItem) {
            const message = messageFactoryItem.getMessage(action, report);
            return <ReportActionItemBasicMessage message={message} />;
        }
        return <View style={{backgroundColor: 'green', width: '100%', height: 200}} />;
    }

    if (isMoneyRequestAction && !shouldRenderMoneyRequestAction) {
        return null;
    }

    if (isClosedReportPreview) {
        return <RenderHTML html={`<comment>${translate('parentReportAction.deletedReport')}</comment>`} />;
    }
    // eslint-disable-next-line react/jsx-props-no-spreading
    return <MessageComponent {...props} />;
}

export default memo(ReportActionMessage, (prevProps, nextProps) => {
    const prevParentReportAction = prevProps.parentReportAction;
    const nextParentReportAction = nextProps.parentReportAction;
    return (
        prevProps.displayAsGroup === nextProps.displayAsGroup &&
        prevProps.isMostRecentIOUReportAction === nextProps.isMostRecentIOUReportAction &&
        prevProps.shouldDisplayNewMarker === nextProps.shouldDisplayNewMarker &&
        lodashIsEqual(prevProps.action, nextProps.action) &&
        lodashIsEqual(prevProps.report?.pendingFields, nextProps.report?.pendingFields) &&
        lodashIsEqual(prevProps.report?.isDeletedParentAction, nextProps.report?.isDeletedParentAction) &&
        lodashIsEqual(prevProps.report?.errorFields, nextProps.report?.errorFields) &&
        prevProps.report?.statusNum === nextProps.report?.statusNum &&
        prevProps.report?.stateNum === nextProps.report?.stateNum &&
        prevProps.report?.parentReportID === nextProps.report?.parentReportID &&
        prevProps.report?.parentReportActionID === nextProps.report?.parentReportActionID &&
        // TaskReport's created actions render the TaskView, which updates depending on certain fields in the TaskReport
        ReportUtils.isTaskReport(prevProps.report) === ReportUtils.isTaskReport(nextProps.report) &&
        prevProps.action.actionName === nextProps.action.actionName &&
        prevProps.report?.reportName === nextProps.report?.reportName &&
        prevProps.report?.description === nextProps.report?.description &&
        ReportUtils.isCompletedTaskReport(prevProps.report) === ReportUtils.isCompletedTaskReport(nextProps.report) &&
        prevProps.report?.managerID === nextProps.report?.managerID &&
        prevProps.shouldHideThreadDividerLine === nextProps.shouldHideThreadDividerLine &&
        prevProps.report?.total === nextProps.report?.total &&
        prevProps.report?.nonReimbursableTotal === nextProps.report?.nonReimbursableTotal &&
        prevProps.report?.policyAvatar === nextProps.report?.policyAvatar &&
        prevProps.linkedReportActionID === nextProps.linkedReportActionID &&
        lodashIsEqual(prevProps.report?.fieldList, nextProps.report?.fieldList) &&
        lodashIsEqual(prevProps.transactionThreadReport, nextProps.transactionThreadReport) &&
        lodashIsEqual(prevProps.reportActions, nextProps.reportActions) &&
        lodashIsEqual(prevParentReportAction, nextParentReportAction)
    );
});
