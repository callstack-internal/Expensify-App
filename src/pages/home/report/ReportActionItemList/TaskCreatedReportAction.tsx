import React from 'react';
import {useOnyx} from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import TaskPreview from '@components/ReportActionItem/TaskPreview';
import {ShowContextMenuContext} from '@components/ShowContextMenuContext';
import useThemeStyles from '@hooks/useThemeStyles';
import * as ReportActionsUtils from '@libs/ReportActionsUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import useContextMenu from './useContextMenu';

type TaskCreatedReportActionProps = {
    displayAsGroup: boolean;
    action: OnyxTypes.ReportAction;
    report: OnyxEntry<OnyxTypes.Report>;
    reportID: string;
    hovered: boolean;
    toggleContextMenuFromActiveReportAction: () => void;
    transactionThreadReport?: OnyxEntry<OnyxTypes.Report>;
};

function TaskCreatedReportAction({displayAsGroup, action, report, reportID, hovered, transactionThreadReport, toggleContextMenuFromActiveReportAction}: TaskCreatedReportActionProps) {
    const styles = useThemeStyles();
    const [reportNameValuePairs] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${report?.reportID ?? '-1'}`);
    const {contextValue, popoverAnchorRef} = useContextMenu(action, report, reportNameValuePairs, transactionThreadReport);

    return (
        <ShowContextMenuContext.Provider value={contextValue}>
            <TaskPreview
                style={displayAsGroup ? [] : [styles.mt1]}
                taskReportID={ReportActionsUtils.isAddCommentAction(action) ? ReportActionsUtils.getOriginalMessage(action)?.taskReportID?.toString() ?? '-1' : '-1'}
                chatReportID={reportID}
                action={action}
                isHovered={hovered}
                contextMenuAnchor={popoverAnchorRef.current}
                checkIfContextMenuActive={toggleContextMenuFromActiveReportAction}
                policyID={report?.policyID ?? '-1'}
            />
        </ShowContextMenuContext.Provider>
    );
}

export default TaskCreatedReportAction;
