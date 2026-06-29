import React from 'react';
import ExportWithDropdownMenu from '@components/ReportActionItem/ExportWithDropdownMenu';
import useOnyx from '@hooks/useOnyx';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import {useReportPreviewActionState, useReportPreviewData} from './MoneyRequestReportPreviewContext';

/**
 * Export-to-accounting branch of the report preview action button. Owns the (Pusher-churning) report actions
 * subscription so it only fires while this branch is mounted, and reads its subject/decision data from context.
 */
function ExportActionButton() {
    const styles = useThemeStyles();
    const {iouReport} = useReportPreviewData();
    const {connectedIntegration} = useReportPreviewActionState();
    const [reportActions] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${iouReport?.reportID}`);

    if (!connectedIntegration) {
        return null;
    }

    return (
        <ExportWithDropdownMenu
            report={iouReport}
            reportActions={reportActions}
            connectionName={connectedIntegration}
            wrapperStyle={styles.flexReset}
            dropdownAnchorAlignment={{
                horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.RIGHT,
                vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.BOTTOM,
            }}
            sentryLabel={CONST.SENTRY_LABEL.REPORT_PREVIEW.EXPORT_BUTTON}
        />
    );
}

export default ExportActionButton;
