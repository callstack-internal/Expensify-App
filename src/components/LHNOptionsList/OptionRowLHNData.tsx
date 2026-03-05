import reportsSelector from '@selectors/Attributes';
import {deepEqual} from 'fast-equals';
import React from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useGetExpensifyCardFromReportAction from '@hooks/useGetExpensifyCardFromReportAction';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import useParentReportAction from '@hooks/useParentReportAction';
import usePolicyForMovingExpenses from '@hooks/usePolicyForMovingExpenses';
import usePrevious from '@hooks/usePrevious';
import {getMovedReportID} from '@libs/ModifiedExpenseMessage';
import {getLastMessageTextForReport} from '@libs/OptionsListUtils';
import {
    getOneTransactionThreadReportID,
    getOriginalMessage,
    getSortedReportActions,
    getSortedReportActionsForDisplay,
    isInviteOrRemovedAction,
    isReportActionVisibleAsLastAction,
} from '@libs/ReportActionsUtils';
import {canUserPerformWriteAction as canUserPerformWriteActionUtil} from '@libs/ReportUtils';
import SidebarUtils from '@libs/SidebarUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {PersonalDetails, ReportAction, ReportNameValuePairs} from '@src/types/onyx';
import OptionRowLHN from './OptionRowLHN';
import type {OptionRowLHNDataProps} from './types';

function privateIsArchivedSelector(reportNameValuePairs: OnyxEntry<ReportNameValuePairs>): string | undefined {
    return reportNameValuePairs?.private_isArchived;
}

/*
 * This component gets the data from onyx for the actual
 * OptionRowLHN component.
 * Each row subscribes to its own data so it only re-renders
 * when its specific data changes.
 */
function OptionRowLHNData(propsToForward: OptionRowLHNDataProps) {
    const reportID = propsToForward.reportID;
    const [reportAttributesDerived] = useOnyx(ONYXKEYS.DERIVED.REPORT_ATTRIBUTES, {selector: reportsSelector});
    const reportAttributes = reportAttributesDerived?.[reportID];

    const {translate, localeCompare} = useLocalize();
    const {isOffline} = useNetwork();
    const {accountID: currentUserAccountID, login} = useCurrentUserPersonalDetails();
    const {policyForMovingExpensesID} = usePolicyForMovingExpenses();

    // Per-item Onyx subscriptions
    const [fullReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const [privateIsArchived] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${reportID}`, {selector: privateIsArchivedSelector});
    const [reportActions] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`);
    const [reportMetadata] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_METADATA}${reportID}`);
    const [personalDetails] = useOnyx(ONYXKEYS.PERSONAL_DETAILS_LIST);

    const parentReportAction = useParentReportAction(fullReport);
    const [parentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${fullReport?.parentReportID}`);
    const [chatReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${fullReport?.chatReportID}`);
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${fullReport?.policyID}`);
    const [policyTags] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_TAGS}${fullReport?.policyID}`);
    const [conciergeReportID] = useOnyx(ONYXKEYS.CONCIERGE_REPORT_ID);

    // Compute invoice receiver policy ID
    let invoiceReceiverPolicyID = '-1';
    if (fullReport?.invoiceReceiver && 'policyID' in fullReport.invoiceReceiver) {
        invoiceReceiverPolicyID = fullReport.invoiceReceiver.policyID;
    }
    if (parentReport?.invoiceReceiver && 'policyID' in parentReport.invoiceReceiver) {
        invoiceReceiverPolicyID = parentReport.invoiceReceiver.policyID;
    }
    const [invoiceReceiverPolicy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${invoiceReceiverPolicyID}`);

    // One transaction thread report
    const oneTransactionThreadReportID = getOneTransactionThreadReportID(fullReport, chatReport, reportActions, isOffline);
    const [oneTransactionThreadReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${oneTransactionThreadReportID}`);

    // Compute archived status
    const isReportArchived = !!privateIsArchived;

    // Compute sorted report actions and last report action
    const canUserPerformWrite = canUserPerformWriteActionUtil(fullReport, isReportArchived);
    const sortedReportActions = getSortedReportActionsForDisplay(reportActions, canUserPerformWrite);
    const lastReportAction = sortedReportActions.at(0);

    // Compute lastAction (the visible action for display)
    let lastAction: ReportAction | undefined;
    if (!reportActions || !fullReport) {
        lastAction = undefined;
    } else {
        const actionsArray = getSortedReportActions(Object.values(reportActions));
        const reportActionsForDisplay = actionsArray.filter(
            (reportAction) => isReportActionVisibleAsLastAction(reportAction, canUserPerformWrite) && reportAction.actionName !== CONST.REPORT.ACTIONS.TYPE.CREATED,
        );
        lastAction = reportActionsForDisplay.at(-1);
    }

    // Last action report (for invite/removed actions)
    const lastActionOriginalMessage = isInviteOrRemovedAction(lastAction) && lastAction?.actionName ? getOriginalMessage(lastAction) : null;
    const lastActionReportID = lastActionOriginalMessage?.reportID;
    const [lastActionReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${lastActionReportID}`);

    // Moved reports for lastAction
    const [movedFromReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getMovedReportID(lastAction, CONST.REPORT.MOVE_TYPE.FROM)}`);
    const [movedToReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getMovedReportID(lastAction, CONST.REPORT.MOVE_TYPE.TO)}`);

    // Moved reports for lastReportAction (used in lastMessageText computation)
    const [movedFromReportForLastReportAction] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getMovedReportID(lastReportAction, CONST.REPORT.MOVE_TYPE.FROM)}`);
    const [movedToReportForLastReportAction] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getMovedReportID(lastReportAction, CONST.REPORT.MOVE_TYPE.TO)}`);

    // Compute last actor details
    let lastActorDetails: Partial<PersonalDetails> | null =
        fullReport?.lastActorAccountID && personalDetails?.[fullReport.lastActorAccountID] ? personalDetails[fullReport.lastActorAccountID] : null;
    if (!lastActorDetails && lastReportAction) {
        const lastActorDisplayName = lastReportAction?.person?.[0]?.text;
        lastActorDetails = lastActorDisplayName
            ? {
                  displayName: lastActorDisplayName,
                  accountID: fullReport?.lastActorAccountID,
              }
            : null;
    }

    // Compute last message text
    const lastMessageTextFromReport = getLastMessageTextForReport({
        translate,
        report: fullReport,
        lastActorDetails,
        movedFromReport: movedFromReportForLastReportAction,
        movedToReport: movedToReportForLastReportAction,
        policy,
        isReportArchived,
        policyForMovingExpensesID,
        chatReport,
        reportMetadata,
        lastAction,
        reportAttributesDerived,
        policyTags,
        currentUserLogin: login ?? '',
    });

    const card = useGetExpensifyCardFromReportAction({reportAction: lastAction, policyID: fullReport?.policyID});

    const optionItem = SidebarUtils.getOptionData({
        report: fullReport,
        reportAttributes,
        oneTransactionThreadReport,
        privateIsArchived,
        personalDetails: personalDetails ?? {},
        policy,
        parentReportAction,
        conciergeReportID,
        lastMessageTextFromReport,
        invoiceReceiverPolicy,
        card,
        lastAction,
        translate,
        localeCompare,
        isReportArchived,
        lastActionReport,
        movedFromReport,
        movedToReport,
        currentUserAccountID,
        reportAttributesDerived,
        policyTags,
        currentUserLogin: login ?? '',
    });

    // Use deep equality to preserve referential identity when the option data hasn't actually changed
    const prevOptionItem = usePrevious(optionItem);
    const stableOptionItem = deepEqual(optionItem, prevOptionItem) ? prevOptionItem : optionItem;

    return (
        <OptionRowLHN
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...propsToForward}
            optionItem={stableOptionItem}
        />
    );
}

OptionRowLHNData.displayName = 'OptionRowLHNData';

export default OptionRowLHNData;
