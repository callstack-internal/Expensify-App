import type {ComponentType} from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import ExportIntegration from '@components/ReportActionItem/ExportIntegration';
import IssueCardMessage from '@components/ReportActionItem/IssueCardMessage';
import MoneyRequestAction from '@components/ReportActionItem/MoneyRequestAction';
import ReportPreview from '@components/ReportActionItem/ReportPreview';
import TaskAction from '@components/ReportActionItem/TaskAction';
import TripRoomPreview from '@components/ReportActionItem/TripRoomPreview';
import * as Localize from '@libs/Localize';
import ModifiedExpenseMessage from '@libs/ModifiedExpenseMessage';
import * as ReportActionsUtils from '@libs/ReportActionsUtils';
import * as ReportUtils from '@libs/ReportUtils';
import CONST from '@src/CONST';
import type * as OnyxTypes from '@src/types/onyx';
import type ReportAction from '@src/types/onyx/ReportAction';
import TaskCreatedReportAction from './TaskCreatedReportAction';

const additionalMessageTypes = {
    CREATED_TASK_ACTION: 'CREATED_TASK_ACTION',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentMap = Record<string, ComponentType<any>>;

type MessageMap = Record<
    string,
    {
        getMessage: (action?: OnyxEntry<ReportAction>, report?: OnyxTypes.Report) => string;
        shouldRenderHtml: boolean;
    }
>;

function getFactoryType(reportAction: OnyxTypes.OnyxInputOrEntry<ReportAction>): string {
    if (ReportActionsUtils.isCreatedTaskReportAction(reportAction)) {
        return additionalMessageTypes.CREATED_TASK_ACTION;
    }
    return reportAction?.actionName ?? 'UNKNOWN';
}

const messageFactory: ComponentMap = {
    [CONST.REPORT.ACTIONS.TYPE.TRIPPREVIEW]: TripRoomPreview,
    [CONST.REPORT.ACTIONS.TYPE.TASK_COMPLETED]: TaskAction,
    [CONST.REPORT.ACTIONS.TYPE.TASK_CANCELLED]: TaskAction,
    [CONST.REPORT.ACTIONS.TYPE.TASK_REOPENED]: TaskAction,
    [CONST.REPORT.ACTIONS.TYPE.TASK_EDITED]: TaskAction,
    [additionalMessageTypes.CREATED_TASK_ACTION]: TaskCreatedReportAction,
    [CONST.REPORT.ACTIONS.TYPE.IOU]: MoneyRequestAction,
    [CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW]: ReportPreview,
    [CONST.REPORT.ACTIONS.TYPE.EXPORTED_TO_INTEGRATION]: ExportIntegration,
    [CONST.REPORT.ACTIONS.TYPE.CARD_ISSUED]: IssueCardMessage,
    [CONST.REPORT.ACTIONS.TYPE.CARD_ISSUED_VIRTUAL]: IssueCardMessage,
    [CONST.REPORT.ACTIONS.TYPE.CARD_MISSING_ADDRESS]: IssueCardMessage,
};

const basicMessageFactory: MessageMap = {
    [CONST.REPORT.ACTIONS.TYPE.REIMBURSEMENT_DEQUEUED]: {
        getMessage: (action?, report?) => ReportUtils.getReimbursementDeQueuedActionMessage(action, report),
        shouldRenderHtml: false,
    },
    [CONST.REPORT.ACTIONS.TYPE.MODIFIED_EXPENSE]: {
        getMessage: (action, report) => ModifiedExpenseMessage.getForReportAction(report?.id, action),
        shouldRenderHtml: false,
    },
    [CONST.REPORT.ACTIONS.TYPE.SUBMITTED]: {
        getMessage: (action) => {
            const wasSubmittedViaHarvesting = ReportActionsUtils.getOriginalMessage(action)?.harvesting ?? false;
            if (wasSubmittedViaHarvesting) {
                return ReportUtils.getReportAutomaticallySubmittedMessage(action);
            }

            return ReportUtils.getIOUSubmittedMessage(action);
        },
        get shouldRenderHtml() {
            return ReportActionsUtils.getOriginalMessage(this.getMessage.arguments[0])?.harvesting ?? false;
        },
    },
    [CONST.REPORT.ACTIONS.TYPE.SUBMITTED_AND_CLOSED]: {
        getMessage: (action) => {
            const wasSubmittedViaHarvesting = ReportActionsUtils.getOriginalMessage(action)?.harvesting ?? false;
            if (wasSubmittedViaHarvesting) {
                return ReportUtils.getReportAutomaticallySubmittedMessage(action);
            }

            return ReportUtils.getIOUSubmittedMessage(action);
        },
        get shouldRenderHtml() {
            return ReportActionsUtils.getOriginalMessage(this.getMessage.arguments[0])?.harvesting ?? false;
        },
    },
    [CONST.REPORT.ACTIONS.TYPE.APPROVED]: {
        getMessage: (action) => {
            const wasAutoApproved = ReportActionsUtils.getOriginalMessage(action)?.automaticAction ?? false;
            if (wasAutoApproved) {
                return ReportUtils.getReportAutomaticallyApprovedMessage(action);
            }

            return ReportUtils.getIOUApprovedMessage(action);
        },
        get shouldRenderHtml() {
            return ReportActionsUtils.getOriginalMessage(this.getMessage.arguments[0])?.automaticAction ?? false;
        },
    },
    [CONST.REPORT.ACTIONS.TYPE.UNAPPROVED]: {
        getMessage: (action) => ReportUtils.getIOUUnapprovedMessage(action),
        shouldRenderHtml: false,
    },
    [CONST.REPORT.ACTIONS.TYPE.FORWARDED]: {
        getMessage: (action, report) => {
            const wasAutoForwarded = ReportActionsUtils.getOriginalMessage(action)?.automaticAction ?? false;
            if (wasAutoForwarded) {
                return ReportUtils.getReportAutomaticallyForwardedMessage(action, report?.id);
            }

            return ReportUtils.getIOUForwardedMessage(action, repot);
        },
        get shouldRenderHtml() {
            return ReportActionsUtils.getOriginalMessage(this.getMessage.arguments[0])?.automaticAction ?? false;
        },
    },
    [CONST.REPORT.ACTIONS.TYPE.REJECTED]: {
        getMessage: () => Localize.translateLocal('iou.rejectedThisReport'),
        shouldRenderHtml: false,
    },
    [CONST.REPORT.ACTIONS.TYPE.HOLD]: {
        getMessage: () => Localize.translateLocal('iou.heldExpense'),
        shouldRenderHtml: false,
    },
};

export {messageFactory, getFactoryType, basicMessageFactory};
