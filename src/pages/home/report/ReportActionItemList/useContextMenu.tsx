import {useCallback, useMemo, useRef, useState} from 'react';
import type {TextInput} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import * as ReportActionContextMenu from '@pages/home/report/ContextMenu/ReportActionContextMenu';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';

function useContextMenu(action: OnyxTypes.ReportAction, report: OnyxEntry<OnyxTypes.Report>, transactionThreadReport: OnyxEntry<OnyxTypes.Report>) {
    const [reportNameValuePairs] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${report?.reportID ?? '-1'}`);
    const [isContextMenuActive, setIsContextMenuActive] = useState<boolean>(() => ReportActionContextMenu.isActiveReportAction(action.reportActionID));

    const popoverAnchorRef = useRef<Exclude<ReportActionContextMenu.ContextMenuAnchor, TextInput>>(null);

    const toggleContextMenuFromActiveReportAction = useCallback(() => {
        setIsContextMenuActive(ReportActionContextMenu.isActiveReportAction(action.reportActionID));
    }, [action.reportActionID]);

    const contextValue = useMemo(
        () => ({
            anchor: popoverAnchorRef.current,
            report: {...report, reportID: report?.reportID ?? ''},
            reportNameValuePairs,
            action,
            transactionThreadReport,
            checkIfContextMenuActive: toggleContextMenuFromActiveReportAction,
            isDisabled: false,
        }),
        [report, action, toggleContextMenuFromActiveReportAction, transactionThreadReport, reportNameValuePairs],
    );

    return {
        isContextMenuActive,
        setIsContextMenuActive,
        toggleContextMenuFromActiveReportAction,
        contextValue,
        popoverAnchorRef,
    };
}

export default useContextMenu;
