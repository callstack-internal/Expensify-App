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
import ReportActionItemContent from './ReportActionItemContent';
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
    [CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT]: ReportActionItemContent,
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
    [CONST.REPORT.ACTIONS.TYPE.HOLD_COMMENT]: {
        getMessage: (action) => ReportActionsUtils.getReportActionText(action),
        shouldRenderHtml: false,
    },
    [CONST.REPORT.ACTIONS.TYPE.UNHOLD]: {
        getMessage: () => Localize.translateLocal('iou.unheldExpense'),
        shouldRenderHtml: false,
    },
    [CONST.REPORT.ACTIONS.TYPE.MERGED_WITH_CASH_TRANSACTION]: {
        getMessage: () => Localize.translateLocal('systemMessage.mergedWithCashTransaction'),
        shouldRenderHtml: false,
    },
    [CONST.REPORT.ACTIONS.TYPE.DISMISSED_VIOLATION]: {
        getMessage: (action) => ReportActionsUtils.getDismissedViolationMessageText(ReportActionsUtils.getOriginalMessage(action)),
        shouldRenderHtml: false,
    },
    [CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.UPDATE_NAME]: {
        getMessage: (action) => ReportUtils.getWorkspaceNameUpdatedMessage(action),
        shouldRenderHtml: false,
    },
    [CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.ADD_EMPLOYEE]: {
        getMessage: (action) => ReportActionsUtils.getPolicyChangeLogAddEmployeeMessage(action),
        shouldRenderHtml: false,
    },
    [CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.UPDATE_EMPLOYEE]: {
        getMessage: (action) => ReportActionsUtils.getPolicyChangeLogChangeRoleMessage(action),
        shouldRenderHtml: false,
    },
    [CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.DELETE_EMPLOYEE]: {
        getMessage: (action) => ReportActionsUtils.getPolicyChangeLogDeleteMemberMessage(action),
        shouldRenderHtml: false,
    },
    [CONST.REPORT.ACTIONS.TYPE.REMOVED_FROM_APPROVAL_CHAIN]: {
        getMessage: (action) => ReportActionsUtils.getRemovedFromApprovalChainMessage(action),
        shouldRenderHtml: false,
    },
    [CONST.REPORT.ACTIONS.TYPE.RENAMED]: {
        getMessage: (action) => ReportActionsUtils.getRenamedAction(action),
        shouldRenderHtml: false,
    },
    [CONST.REPORT.ACTIONS.TYPE.INTEGRATION_SYNC_FAILED]: {
        getMessage: (action) => {
            const {label, errorMessage} = ReportActionsUtils.getOriginalMessage(action) ?? {label: '', errorMessage: ''};
            return Localize.translateLocal('report.actions.type.integrationSyncFailed', {label, errorMessage});
        },
        shouldRenderHtml: false,
    },
    [CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.DELETE_INTEGRATION]: {
        getMessage: (action) => ReportActionsUtils.getRemovedConnectionMessage(action),
        shouldRenderHtml: false,
    },
};

export {messageFactory, getFactoryType, basicMessageFactory};
