import {useRoute} from '@react-navigation/native';
import type {ReactNode} from 'react';
import React from 'react';
import DragAndDropProvider from '@components/DragAndDrop/Provider';
import useReportIsArchived from '@hooks/useReportIsArchived';
import useThreadReport from '@hooks/useThreadReport';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {canUserPerformWriteAction} from '@libs/ReportUtils';

function ReportDragAndDropProvider({children}: {children: ReactNode}) {
    const route = useRoute();
    const routeParams = route.params as {reportID?: string} | undefined;
    const reportIDFromRoute = getNonEmptyStringOnyxID(routeParams?.reportID);

    const report = useThreadReport(reportIDFromRoute);
    const isReportArchived = useReportIsArchived(report?.reportID);
    const isEditingDisabled = !canUserPerformWriteAction(report, isReportArchived);

    return <DragAndDropProvider isDisabled={isEditingDisabled}>{children}</DragAndDropProvider>;
}

export default ReportDragAndDropProvider;
