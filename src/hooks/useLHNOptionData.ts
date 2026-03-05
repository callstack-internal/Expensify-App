import reportsSelector from '@selectors/Attributes';
import {deepEqual} from 'fast-equals';
import type {OnyxEntry} from 'react-native-onyx';
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
import type {OptionData} from '@libs/ReportUtils';
import {canUserPerformWriteAction as canUserPerformWriteActionUtil} from '@libs/ReportUtils';
import SidebarUtils from '@libs/SidebarUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {PersonalDetails, ReportAction, ReportNameValuePairs} from '@src/types/onyx';
import useCurrentUserPersonalDetails from './useCurrentUserPersonalDetails';
import useGetExpensifyCardFromReportAction from './useGetExpensifyCardFromReportAction';
import useLocalize from './useLocalize';
import useNetwork from './useNetwork';
import useOnyx from './useOnyx';
import useParentReportAction from './useParentReportAction';
import usePolicyForMovingExpenses from './usePolicyForMovingExpenses';
import usePrevious from './usePrevious';

type LHNOptionData = Pick<
    OptionData,
    | 'text'
    | 'alternateText'
    | 'icons'
    | 'displayNamesWithTooltips'
    | 'shouldShowSubscript'
    | 'parentReportAction'
    | 'isUnread'
    | 'notificationPreference'
    | 'isChatRoom'
    | 'isPolicyExpenseChat'
    | 'isTaskReport'
    | 'isThread'
    | 'isMoneyRequestReport'
    | 'isInvoiceReport'
    | 'private_isArchived'
>;

function privateIsArchivedSelector(reportNameValuePairs: OnyxEntry<ReportNameValuePairs>): string | undefined {
    return reportNameValuePairs?.private_isArchived;
}

function useLHNOptionData(reportID: string): LHNOptionData | undefined {
    const [reportAttributesDerived] = useOnyx(ONYXKEYS.DERIVED.REPORT_ATTRIBUTES, {selector: reportsSelector});
    const reportAttributes = reportAttributesDerived?.[reportID];

    const {translate, localeCompare} = useLocalize();
    const {isOffline} = useNetwork();
    const {accountID: currentUserAccountID, login} = useCurrentUserPersonalDetails();
    const {policyForMovingExpensesID} = usePolicyForMovingExpenses();

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

    let invoiceReceiverPolicyID = '-1';
    if (fullReport?.invoiceReceiver && 'policyID' in fullReport.invoiceReceiver) {
        invoiceReceiverPolicyID = fullReport.invoiceReceiver.policyID;
    }
    if (parentReport?.invoiceReceiver && 'policyID' in parentReport.invoiceReceiver) {
        invoiceReceiverPolicyID = parentReport.invoiceReceiver.policyID;
    }
    const [invoiceReceiverPolicy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${invoiceReceiverPolicyID}`);

    const oneTransactionThreadReportID = getOneTransactionThreadReportID(fullReport, chatReport, reportActions, isOffline);
    const [oneTransactionThreadReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${oneTransactionThreadReportID}`);

    const isReportArchived = !!privateIsArchived;
    const canUserPerformWrite = canUserPerformWriteActionUtil(fullReport, isReportArchived);
    const sortedReportActions = getSortedReportActionsForDisplay(reportActions, canUserPerformWrite);
    const lastReportAction = sortedReportActions.at(0);

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

    const lastActionOriginalMessage = isInviteOrRemovedAction(lastAction) && lastAction?.actionName ? getOriginalMessage(lastAction) : null;
    const lastActionReportID = lastActionOriginalMessage?.reportID;
    const [lastActionReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${lastActionReportID}`);

    const [movedFromReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getMovedReportID(lastAction, CONST.REPORT.MOVE_TYPE.FROM)}`);
    const [movedToReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getMovedReportID(lastAction, CONST.REPORT.MOVE_TYPE.TO)}`);

    const [movedFromReportForLastReportAction] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getMovedReportID(lastReportAction, CONST.REPORT.MOVE_TYPE.FROM)}`);
    const [movedToReportForLastReportAction] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getMovedReportID(lastReportAction, CONST.REPORT.MOVE_TYPE.TO)}`);

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

    const fullOption = SidebarUtils.getOptionData({
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

    const result: LHNOptionData | undefined = fullOption
        ? {
              text: fullOption.text,
              alternateText: fullOption.alternateText,
              icons: fullOption.icons,
              displayNamesWithTooltips: fullOption.displayNamesWithTooltips,
              shouldShowSubscript: fullOption.shouldShowSubscript,
              parentReportAction: fullOption.parentReportAction,
              isUnread: fullOption.isUnread,
              notificationPreference: fullOption.notificationPreference,
              isChatRoom: fullOption.isChatRoom,
              isPolicyExpenseChat: fullOption.isPolicyExpenseChat,
              isTaskReport: fullOption.isTaskReport,
              isThread: fullOption.isThread,
              isMoneyRequestReport: fullOption.isMoneyRequestReport,
              isInvoiceReport: fullOption.isInvoiceReport,
              private_isArchived: fullOption.private_isArchived,
          }
        : undefined;

    const prevResult = usePrevious(result);
    return deepEqual(result, prevResult) ? prevResult : result;
}

export default useLHNOptionData;
export type {LHNOptionData};
