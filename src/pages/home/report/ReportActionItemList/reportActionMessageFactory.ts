import type {ComponentType} from 'react';
import TaskAction from '@components/ReportActionItem/TaskAction';
import TripRoomPreview from '@components/ReportActionItem/TripRoomPreview';
import * as ReportActionsUtils from '@libs/ReportActionsUtils';
import CONST from '@src/CONST';
import type {OnyxInputOrEntry} from '@src/types/onyx';
import type ReportAction from '@src/types/onyx/ReportAction';
import TaskCreatedReportAction from './TaskCreatedReportAction';

const additionalMessageTypes = {
    CREATED_TASK_ACTION: 'CREATED_TASK_ACTION',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentMap = Record<string, ComponentType<any>>;

function getFactoryType(reportAction: OnyxInputOrEntry<ReportAction>): string {
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
};

export {messageFactory, getFactoryType};
