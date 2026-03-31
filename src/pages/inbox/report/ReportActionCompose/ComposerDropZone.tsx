import React from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import DragAndDropConsumer from '@components/DragAndDrop/Consumer';
import DropZoneUI from '@components/DropZone/DropZoneUI';
import DualDropZone from '@components/DropZone/DualDropZone';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import usePreferredPolicy from '@hooks/usePreferredPolicy';
import useReportIsArchived from '@hooks/useReportIsArchived';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {getLinkedTransactionID, getReportAction, isMoneyRequestAction} from '@libs/ReportActionsUtils';
import {
    canEditFieldOfMoneyRequest,
    canUserPerformWriteAction as canUserPerformWriteActionReportUtils,
    getParentReport,
    isChatRoom,
    isGroupChat,
    isInvoiceReport,
    isReportApproved,
    isReportTransactionThread,
    isSettled,
    temporary_getMoneyRequestOptions,
} from '@libs/ReportUtils';
import {getTransactionID, hasReceipt as hasReceiptTransactionUtils} from '@libs/TransactionUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';

type ComposerDropZoneProps = {
    report: OnyxEntry<OnyxTypes.Report>;
    reportTransactions?: OnyxEntry<OnyxTypes.Transaction[]>;
    onAttachmentDrop: (event: DragEvent) => void;
    onReceiptDrop: (event: DragEvent) => void;
};

function SimpleDropOverlay({onAttachmentDrop}: {onAttachmentDrop: (event: DragEvent) => void}) {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const theme = useTheme();
    const icons = useMemoizedLazyExpensifyIcons(['MessageInABottle']);

    return (
        <DragAndDropConsumer onDrop={onAttachmentDrop}>
            <DropZoneUI
                icon={icons.MessageInABottle}
                dropTitle={translate('dropzone.addAttachments')}
                dropStyles={styles.attachmentDropOverlay(true)}
                dropTextStyles={styles.attachmentDropText}
                dashedBorderStyles={[styles.dropzoneArea, styles.easeInOpacityTransition, styles.activeDropzoneDashedBorder(theme.attachmentDropBorderColorActive, true)]}
            />
        </DragAndDropConsumer>
    );
}

type RichDropZoneProps = {
    report: OnyxEntry<OnyxTypes.Report>;
    reportTransactions?: OnyxEntry<OnyxTypes.Transaction[]>;
    onAttachmentDrop: (event: DragEvent) => void;
    onReceiptDrop: (event: DragEvent) => void;
};

function RichDropZone({report, reportTransactions, onAttachmentDrop, onReceiptDrop}: RichDropZoneProps) {
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const {isRestrictedToPreferredPolicy} = usePreferredPolicy();
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`);
    const [betas] = useOnyx(ONYXKEYS.BETAS);
    const isReportArchived = useReportIsArchived(report?.reportID);
    const isTransactionThreadView = isReportTransactionThread(report);
    const isExpensesReport = reportTransactions && reportTransactions.length > 1;

    const [reportActions] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report?.reportID}`, {
        canEvict: false,
    });

    const iouAction = reportActions ? Object.values(reportActions).find((action) => isMoneyRequestAction(action)) : null;
    const linkedTransactionID = iouAction && !isExpensesReport ? getLinkedTransactionID(iouAction) : undefined;
    const transactionID = getTransactionID(report) ?? linkedTransactionID;
    const [transaction] = useOnyx(`${ONYXKEYS.COLLECTION.TRANSACTION}${getNonEmptyStringOnyxID(transactionID)}`);

    const isSingleTransactionView = !!transaction && !!reportTransactions && reportTransactions.length === 1;
    const parentReportAction = isSingleTransactionView ? iouAction : getReportAction(report?.parentReportID, report?.parentReportActionID);
    const canUserPerformWriteAction = !!canUserPerformWriteActionReportUtils(report, isReportArchived);
    const canEditReceipt =
        canUserPerformWriteAction &&
        canEditFieldOfMoneyRequest({reportAction: parentReportAction, fieldToEdit: CONST.EDIT_REQUEST_FIELD.RECEIPT, transaction}) &&
        !transaction?.receipt?.isTestDriveReceipt;
    const shouldAddOrReplaceReceipt = (isTransactionThreadView || isSingleTransactionView) && canEditReceipt;
    const hasReceipt = hasReceiptTransactionUtils(transaction);

    const reportParticipantIDs = Object.keys(report?.participants ?? {})
        .map(Number)
        .filter((accountID) => accountID !== currentUserPersonalDetails.accountID);

    const shouldDisplayDualDropZone = (() => {
        const parentReport = getParentReport(report);
        const isSettledOrApproved = isSettled(report) || isSettled(parentReport) || isReportApproved({report}) || isReportApproved({report: parentReport});
        const hasMoneyRequestOptions = !!temporary_getMoneyRequestOptions(report, policy, reportParticipantIDs, betas, isReportArchived, isRestrictedToPreferredPolicy).length;
        const canModifyReceipt = shouldAddOrReplaceReceipt && !isSettledOrApproved;
        const isRoomOrGroupChat = isChatRoom(report) || isGroupChat(report);
        return !isRoomOrGroupChat && (canModifyReceipt || hasMoneyRequestOptions) && !isInvoiceReport(report);
    })();

    if (!shouldDisplayDualDropZone) {
        return <SimpleDropOverlay onAttachmentDrop={onAttachmentDrop} />;
    }

    return (
        <DualDropZone
            isEditing={shouldAddOrReplaceReceipt && hasReceipt}
            onAttachmentDrop={onAttachmentDrop}
            onReceiptDrop={onReceiptDrop}
            shouldAcceptSingleReceipt={shouldAddOrReplaceReceipt}
        />
    );
}

function ComposerDropZone({report, reportTransactions, onAttachmentDrop, onReceiptDrop}: ComposerDropZoneProps) {
    if (isChatRoom(report) || isGroupChat(report) || isInvoiceReport(report)) {
        return <SimpleDropOverlay onAttachmentDrop={onAttachmentDrop} />;
    }

    return (
        <RichDropZone
            report={report}
            reportTransactions={reportTransactions}
            onAttachmentDrop={onAttachmentDrop}
            onReceiptDrop={onReceiptDrop}
        />
    );
}

export default ComposerDropZone;
