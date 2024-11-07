import React, {useState} from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import {useOnyx} from 'react-native-onyx';
import RenderHTML from '@components/RenderHTML';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import * as ReportActionsUtils from '@libs/ReportActionsUtils';
import * as ReportUtils from '@libs/ReportUtils';
import useContextMenu from '@pages/home/report/ReportActionItemList/useContextMenu';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import ReportPreview from './ReportPreview';

function ReportPreviewAction({
    action,
    report,
    transactionThreadReport,
    reportID,
    displayAsGroup,
    isWhisper,
    hovered,
}: {
    action: OnyxTypes.ReportAction;
    report: OnyxEntry<OnyxTypes.Report>;
    transactionThreadReport?: OnyxEntry<OnyxTypes.Report>;
    reportID: string;
    displayAsGroup: boolean;
    isWhisper: boolean;
    hovered: boolean;
}) {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const [iouReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${ReportActionsUtils.getIOUReportIDFromReportActionPreview(action) ?? -1}`);
    const {toggleContextMenuFromActiveReportAction, popoverAnchorRef} = useContextMenu(action, report, transactionThreadReport);
    // The next hook, probably should be in the parent
    const [isPaymentMethodPopoverActive, setIsPaymentMethodPopoverActive] = useState<boolean | undefined>();

    if (ReportUtils.isClosedExpenseReportWithNoExpenses(iouReport)) {
        return <RenderHTML html={`<comment>${translate('parentReportAction.deletedReport')}</comment>`} />;
    }
    return (
        <ReportPreview
            iouReportID={ReportActionsUtils.getIOUReportIDFromReportActionPreview(action)}
            chatReportID={reportID}
            policyID={report?.policyID ?? '-1'}
            containerStyles={displayAsGroup ? [] : [styles.mt2]}
            action={action}
            isHovered={hovered}
            contextMenuAnchor={popoverAnchorRef.current}
            checkIfContextMenuActive={toggleContextMenuFromActiveReportAction}
            onPaymentOptionsShow={() => setIsPaymentMethodPopoverActive(true)}
            onPaymentOptionsHide={() => setIsPaymentMethodPopoverActive(false)}
            isWhisper={isWhisper}
        />
    );
}

export default ReportPreviewAction;
