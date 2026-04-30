import React from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import useOnyx from '@hooks/useOnyx';
import usePolicy from '@hooks/usePolicy';
import useReportIsArchived from '@hooks/useReportIsArchived';
import {isPolicyExpenseChat} from '@libs/ReportUtils';
import ScanEditReceipt from '@pages/iou/request/step/IOURequestStepScan/components/ScanEditReceipt';
import ScanFromReport from '@pages/iou/request/step/IOURequestStepScan/components/ScanFromReport';
import ScanGlobalCreate from '@pages/iou/request/step/IOURequestStepScan/components/ScanGlobalCreate';
import ScanSkipConfirmation from '@pages/iou/request/step/IOURequestStepScan/components/ScanSkipConfirmation';
import CONST from '@src/CONST';
import type {IOUAction, IOUType} from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Route} from '@src/ROUTES';
import type {Report} from '@src/types/onyx';
import type Transaction from '@src/types/onyx/Transaction';

type ScanRouterProps = {
    report: OnyxEntry<Report>;
    action: IOUAction;
    iouType: IOUType;
    reportID: string;
    transactionID: string;
    transaction: OnyxEntry<Transaction>;
    backTo: Route | undefined;
    backToReport: string | undefined;
};

/**
 * ScanRouter — thin routing layer that selects the appropriate scan variant
 * based on route params and transaction state.
 *
 * Variant selection:
 *   Edit       — replacing an existing receipt (backTo or isEditing)
 *   SkipConfirm — quick action with skipConfirmation flag (direct submit)
 *   FromReport — initiated from report (+) button (sets participants, shows confirmation)
 *   GlobalCreate — FAB (+) global create (auto-selects workspace or shows participant picker)
 */
function ScanRouter({report, action, iouType, reportID, transactionID, transaction, backTo, backToReport}: ScanRouterProps) {
    const policy = usePolicy(report?.policyID);
    const isArchived = useReportIsArchived(report?.reportID);
    const [skipConfirmation] = useOnyx(`${ONYXKEYS.COLLECTION.SKIP_CONFIRMATION}${transactionID}`);

    const isEditing = action === CONST.IOU.ACTION.EDIT;

    // Edit/replace receipt flow
    if (backTo || isEditing) {
        return (
            <ScanEditReceipt
                report={report}
                transactionID={transactionID}
                backTo={backTo}
            />
        );
    }

    const isFromGlobalCreate = !!transaction?.isFromGlobalCreate;
    const shouldSkipConfirmation =
        !!skipConfirmation && !!report?.reportID && !isArchived && !(isPolicyExpenseChat(report) && ((policy?.requiresCategory ?? false) || (policy?.requiresTag ?? false)));

    // From-report flows (not global create, not archived)
    if (!isFromGlobalCreate && !isArchived && iouType !== CONST.IOU.TYPE.CREATE) {
        if (shouldSkipConfirmation) {
            return (
                <ScanSkipConfirmation
                    report={report}
                    iouType={iouType}
                    reportID={reportID}
                    transactionID={transactionID}
                    transaction={transaction}
                    backToReport={backToReport}
                />
            );
        }

        return (
            <ScanFromReport
                report={report}
                iouType={iouType}
                reportID={reportID}
                transactionID={transactionID}
                transaction={transaction}
                backToReport={backToReport}
            />
        );
    }

    // Global create flow (FAB or archived report)
    return (
        <ScanGlobalCreate
            report={report}
            iouType={iouType}
            reportID={reportID}
            transactionID={transactionID}
            transaction={transaction}
            backToReport={backToReport}
        />
    );
}

ScanRouter.displayName = 'ScanRouter';

export default ScanRouter;
