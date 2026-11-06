/**
 * Pure per-report computations behind the report attributes (name, RBR/GBR status, action badge) that the LHN,
 * option lists and report screens show. They take every Onyx input as a parameter, so ReportAttributesCache can
 * run them from the state the useOnyxState hooks hand in.
 */

import type {LocaleContextProps, LocalizedTranslate} from '@components/LocaleContextProvider';

import type {CurrencyListActionsContextType} from '@hooks/useCurrencyList';

import CONST from '@src/CONST';
import IntlStore from '@src/languages/IntlStore';
import ONYXKEYS from '@src/ONYXKEYS';
import type {
    CardList,
    CurrencyList,
    IntroSelected,
    Locale,
    PersonalDetailsList,
    Policy,
    PolicyTagLists,
    Report,
    ReportActions,
    ReportAttributesDerivedValue,
    ReportMetadata,
    ReportNameValuePairs,
    Rule,
    Session,
    Transaction,
    TransactionViolation,
} from '@src/types/onyx';
import type {ReportAttributes} from '@src/types/onyx/DerivedValues';

import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';

import {isTrackIntentUserSelector} from '@selectors/Onboarding';

import {getReportPreviewReportAction} from './actions/IOU/MoneyRequestBuilder';
import {convertToFrontendAmountAsInteger, sanitizeCurrencyCode} from './CurrencyUtils';
import {formatPhoneNumberWithCountryCode} from './LocalePhoneNumber';
import {translate as translateForLocale} from './Localize';
import {format, formatToParts} from './NumberFormatUtils';
import {getLoginByAccountID} from './PersonalDetailsUtils';
import {isDeletedAction} from './ReportActionsUtils';
import {computeReportName} from './ReportNameUtils';
import {
    generateReportAttributes,
    getPendingDeleteMemberAccountIDs,
    hasViolations,
    hasVisibleReportFieldViolations,
    isArchivedReport,
    isOpenReport,
    isPolicyAdmin,
    isPolicyExpenseChat,
    isProcessingReport,
    isSupportTicket,
} from './ReportUtils';
import SidebarUtils from './SidebarUtils';

type ReportAttributesInputs = {
    reports: OnyxCollection<Report>;
    reportActions: OnyxCollection<ReportActions>;
    reportNameValuePairs: OnyxCollection<ReportNameValuePairs>;
    reportMetadata: OnyxCollection<ReportMetadata>;
    transactions: OnyxCollection<Transaction>;
    transactionViolations: OnyxCollection<TransactionViolation[]>;
    personalDetails: OnyxEntry<PersonalDetailsList>;
    session: OnyxEntry<Session>;
    policies: OnyxCollection<Policy>;
    policyTags: OnyxCollection<PolicyTagLists>;
    conciergeReportID: OnyxEntry<string>;
    introSelected: OnyxEntry<IntroSelected>;
    rules: OnyxCollection<Rule>;
    cardList: OnyxEntry<CardList>;
    isOffline: boolean;
    /** Transactions grouped by their reportID, see `buildTransactionsByReportID`. */
    reportsTransactions: Record<string, Transaction[]>;
};

type ReportAttributesFormatters = {
    translate: LocalizedTranslate;
    dateFnsLocale: ReturnType<typeof IntlStore.getDateFnsLocale>;
    formatPhoneNumber: LocaleContextProps['formatPhoneNumber'];
    getCurrencySymbol: CurrencyListActionsContextType['getCurrencySymbol'];
    convertToDisplayString: CurrencyListActionsContextType['convertToDisplayString'];
    convertToDisplayStringWithoutCurrency: CurrencyListActionsContextType['convertToDisplayStringWithoutCurrency'];
};

type ReportStatusEntry = Omit<ReportAttributes, 'reportName' | 'isEmpty'>;

/**
 * There is no component here to inject the formatters from LocaleContextProvider and CurrencyListContextProvider,
 * so this mirrors the providers' implementations from the locale and the currency list.
 */
function buildReportAttributesFormatters(preferredLocale: OnyxEntry<Locale>, countryCodeByIP: OnyxEntry<number>, currencyList: OnyxEntry<CurrencyList>): ReportAttributesFormatters {
    const getCurrencyDecimals = (currencyCode: string): number => currencyList?.[currencyCode]?.decimals ?? CONST.DEFAULT_CURRENCY_DECIMALS;
    return {
        translate: (path, ...parameters) => translateForLocale(preferredLocale, path, ...parameters),
        dateFnsLocale: IntlStore.getDateFnsLocale(preferredLocale),
        formatPhoneNumber: (phoneNumber) => formatPhoneNumberWithCountryCode(phoneNumber, countryCodeByIP ?? CONST.DEFAULT_COUNTRY_CODE),
        getCurrencySymbol: (currencyCode) => currencyList?.[currencyCode]?.symbol,
        convertToDisplayString: (amountInCents, currencyCode) => {
            const sanitizedCurrency = sanitizeCurrencyCode(currencyCode);
            const decimals = getCurrencyDecimals(sanitizedCurrency);
            const convertedAmount = convertToFrontendAmountAsInteger(amountInCents ?? 0, decimals);
            return format(preferredLocale, convertedAmount, {
                style: 'currency',
                currency: sanitizedCurrency,

                // We are forcing the number of decimals because we override the default number of decimals in the backend for some currencies
                // See: https://github.com/Expensify/PHP-Libs/pull/834
                minimumFractionDigits: decimals,
                // For currencies that have decimal places > 2, floor to 2 instead as we don't support more than 2 decimal places.
                maximumFractionDigits: 2,
            });
        },
        convertToDisplayStringWithoutCurrency: (amountInCents, currencyCode = CONST.CURRENCY.USD) => {
            const sanitizedCurrency = sanitizeCurrencyCode(currencyCode);
            const decimals = getCurrencyDecimals(sanitizedCurrency);
            const convertedAmount = convertToFrontendAmountAsInteger(amountInCents, decimals);
            return formatToParts(preferredLocale, convertedAmount, {
                style: 'currency',
                currency: sanitizedCurrency,
                minimumFractionDigits: decimals,
                maximumFractionDigits: 2,
            })
                .filter((x) => x.type !== 'currency')
                .filter((x) => x.type !== 'literal' || x.value.trim().length !== 0)
                .map((x) => x.value)
                .join('');
        },
    };
}

/**
 * `getReportNameByID` names the report a moved or unreported transaction thread took its expense from. Leave it
 * undefined when computing that report's name, so a chain of such threads stops after one step.
 */
function computeReportNameEntry(
    report: Report,
    inputs: ReportAttributesInputs,
    formatters: ReportAttributesFormatters,
    getReportNameByID: ((reportID: string) => string | undefined) | undefined,
): string {
    const reportMetadata = inputs.reportMetadata?.[`${ONYXKEYS.COLLECTION.REPORT_METADATA}${report.reportID}`];
    return computeReportName({
        report,
        reports: inputs.reports,
        policies: inputs.policies,
        transactions: inputs.transactions,
        allReportNameValuePairs: inputs.reportNameValuePairs,
        personalDetailsList: inputs.personalDetails,
        reportActions: inputs.reportActions,
        currentUserAccountID: inputs.session?.accountID ?? CONST.DEFAULT_NUMBER_ID,
        currentUserLogin: inputs.session?.email ?? '',
        translate: formatters.translate,
        dateFnsLocale: formatters.dateFnsLocale,
        allPolicyTags: inputs.policyTags,
        conciergeReportID: inputs.conciergeReportID ?? undefined,
        getReportNameByID,
        reportTransactions: inputs.reportsTransactions,
        isTrackIntentUser: isTrackIntentUserSelector(inputs.introSelected),
        convertToDisplayString: formatters.convertToDisplayString,
        convertToDisplayStringWithoutCurrency: formatters.convertToDisplayStringWithoutCurrency,
        getCurrencySymbol: formatters.getCurrencySymbol,
        pendingDeleteMemberAccountIDs: getPendingDeleteMemberAccountIDs(reportMetadata?.pendingChatMembers),
        formatPhoneNumber: formatters.formatPhoneNumber,
        rules: inputs.rules,
    });
}

function computeReportStatusEntry(report: Report, inputs: ReportAttributesInputs): ReportStatusEntry {
    const {reports, reportActions, transactionViolations, transactions, policies, session, rules, cardList, isOffline} = inputs;
    const currentUserAccountID = session?.accountID ?? CONST.DEFAULT_NUMBER_ID;
    const chatReport = reports?.[`${ONYXKEYS.COLLECTION.REPORT}${report.chatReportID}`];
    const reportNameValuePair = inputs.reportNameValuePairs?.[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${report.reportID}`];
    const reportActionsList = reportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.reportID}`];
    const isReportArchived = isArchivedReport(reportNameValuePair);
    const reportMetadata = inputs.reportMetadata?.[`${ONYXKEYS.COLLECTION.REPORT_METADATA}${report.reportID}`];
    const {
        violatingReportID,
        hasAnyViolations,
        requiresAttention,
        reportErrors,
        oneTransactionThreadReportID,
        actionBadge: actionGreenBadge,
        actionTargetReportActionID: actionGreenTargetReportActionID,
    } = generateReportAttributes({
        report,
        chatReport,
        reportActions,
        transactionViolations,
        isReportArchived,
        allTransactions: transactions,
        reports,
        policies,
        reportMetadata,
        cardList,
        currentUserAccountID,
        currentUserLogin: session?.email ?? '',
    });

    const policy = policies?.[`${ONYXKEYS.COLLECTION.POLICY}${report.policyID}`];
    const hasFieldViolations = hasVisibleReportFieldViolations(report, policy, session?.accountID, rules, reportNameValuePair);

    let brickRoadStatus;
    let actionBadge;
    let actionTargetReportActionID;
    let needsParentChatErrorPropagation = false;
    const reasonAndReportAction = SidebarUtils.getReasonAndReportActionThatHasRedBrickRoad({
        report,
        chatReport,
        reportActions: reportActionsList,
        hasViolations: hasAnyViolations || hasFieldViolations,
        reportErrors,
        transactions,
        isOffline,
        currentUserAccountID,
        transactionViolations,
        isReportArchived: !!isReportArchived,
        reports,
        violatingReportID,
    });

    // When the report is ready to submit, always show the green Submit badge
    // regardless of violations — the user can submit without fix.
    const willShowGreenSubmit = requiresAttention && actionGreenBadge === CONST.REPORT.ACTION_BADGE.SUBMIT;

    // if report has errors or violations, show red dot
    // Also skip setting ERROR when we'll show the green Submit badge — let the user submit without fix.
    if (!isSupportTicket(report) && reasonAndReportAction && !willShowGreenSubmit) {
        needsParentChatErrorPropagation = true;

        // RBR/Fix mirrors GBR's access rule: only show on the child when the user can't already
        // see it on the parent workspace chat. The parent still gets ERROR/FIX through
        // getParentChatPropagationUpdates, so the actionable indicator surfaces on the workspace chat row
        // (which is where C+ wants it). Skips when the chat parent isn't accessible to the user.
        const chatPolicy = chatReport?.policyID ? policies?.[`${ONYXKEYS.COLLECTION.POLICY}${chatReport.policyID}`] : undefined;
        const isChildOfAccessiblePolicyExpenseChat = !!chatReport && isPolicyExpenseChat(chatReport) && (!!chatReport.isOwnPolicyExpenseChat || isPolicyAdmin(chatPolicy));
        if (!isChildOfAccessiblePolicyExpenseChat) {
            brickRoadStatus = CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR;
            actionBadge = CONST.REPORT.ACTION_BADGE.FIX;
            actionTargetReportActionID = reasonAndReportAction.reportAction?.reportActionID;
        }
    }
    // if report does not have error, check if it should show green dot
    if (brickRoadStatus !== CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR && requiresAttention) {
        brickRoadStatus = CONST.BRICK_ROAD_INDICATOR_STATUS.INFO;
        actionBadge = actionGreenBadge;
        actionTargetReportActionID = actionGreenTargetReportActionID;
    }

    return {
        brickRoadStatus,
        requiresAttention,
        actionBadge,
        actionTargetReportActionID,
        reportErrors,
        oneTransactionThreadReportID,
        needsParentChatErrorPropagation,
    };
}

// Returns the report-preview action ID of the oldest child in `reportIDs` matching `predicate`
// (oldest by preview-action creation time), or undefined when none match.
const getOldestPreviewActionID = (
    chatReportID: string,
    reportIDs: string[] | undefined,
    reports: OnyxCollection<Report>,
    chatReportActions: OnyxEntry<ReportActions>,
    predicate?: (childReport: OnyxEntry<Report>) => boolean,
) => {
    let oldestCreated: string | undefined;
    let targetReportActionID: string | undefined;
    for (const childReportID of reportIDs ?? []) {
        if (predicate && !predicate(reports?.[`${ONYXKEYS.COLLECTION.REPORT}${childReportID}`])) {
            continue;
        }
        const reportPreviewAction = getReportPreviewReportAction(chatReportID, childReportID, chatReportActions);
        if (!reportPreviewAction) {
            continue;
        }
        if (oldestCreated === undefined || reportPreviewAction.created < oldestCreated) {
            oldestCreated = reportPreviewAction.created;
            targetReportActionID = reportPreviewAction.reportActionID;
        }
    }
    return targetReportActionID;
};

const isActionable = (childReport: OnyxEntry<Report>) => isOpenReport(childReport) || isProcessingReport(childReport);

// Open/processing and the user still needs to fix a violation on it. Violations are read directly from
// transactionViolations so this works even when owner data is absent (e.g. masked Onyx exports).
const needsViolationFix = (
    childReport: OnyxEntry<Report>,
    childReportOwnerLogin: string | undefined,
    policies: OnyxCollection<Policy>,
    transactionViolations: OnyxCollection<TransactionViolation[]>,
    currentUserAccountID: number,
    currentUserEmail: string,
) => {
    if (!childReport || !isActionable(childReport)) {
        return false;
    }
    const childPolicy = policies?.[`${ONYXKEYS.COLLECTION.POLICY}${childReport.policyID}`];
    return hasViolations(childReport.reportID, transactionViolations, currentUserAccountID, currentUserEmail, true, undefined, childReport, childReportOwnerLogin, childPolicy);
};

/**
 * Returns the new entries of the parent chats that have an errored child report: ERROR/FIX, with the badge pointing
 * at the oldest actionable child preview.
 */
function getParentChatPropagationUpdates(reportAttributes: ReportAttributesDerivedValue['reports'], inputs: ReportAttributesInputs): ReportAttributesDerivedValue['reports'] {
    const {reports, reportActions, personalDetails, policies, transactionViolations, session} = inputs;
    const currentUserAccountID = session?.accountID ?? CONST.DEFAULT_NUMBER_ID;
    const currentUserEmail = session?.email ?? '';
    const erroredChildReportIDsByChat = new Map<string, string[]>();
    const childReportIDsByChat = new Map<string, string[]>();
    for (const report of Object.values(reports ?? {})) {
        if (!report?.reportID || !report.chatReportID || report.reportID === report.chatReportID) {
            continue;
        }

        const childReportIDs = childReportIDsByChat.get(report.chatReportID) ?? [];
        childReportIDs.push(report.reportID);
        childReportIDsByChat.set(report.chatReportID, childReportIDs);

        // We read `needsParentChatErrorPropagation` rather than `brickRoadStatus` because the per-report
        // pass suppresses the child's own brickRoadStatus when the parent workspace chat is accessible —
        // we still need to propagate the error up so the parent shows the indicator.
        const attributes = reportAttributes[report.reportID];
        if (!attributes?.needsParentChatErrorPropagation && attributes?.brickRoadStatus !== CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR) {
            continue;
        }

        // When the child IOU's parent action in the chat is deleted (e.g. another user deleted the request
        // while an optimistic pay was queued offline), the chat has no actionable surface for the error.
        // Skip propagation so the parent DM row doesn't show a stale "Fix" for a request that no longer exists.
        // Checked only for children with an error, as it is the costly part of this loop over every report.
        const parentReportAction = report.parentReportActionID ? reportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.parentReportID}`]?.[report.parentReportActionID] : undefined;
        if (isDeletedAction(parentReportAction)) {
            continue;
        }

        const erroredChildReportIDs = erroredChildReportIDsByChat.get(report.chatReportID) ?? [];
        erroredChildReportIDs.push(report.reportID);
        erroredChildReportIDsByChat.set(report.chatReportID, erroredChildReportIDs);
    }

    const updates: ReportAttributesDerivedValue['reports'] = {};
    for (const [chatReportID, erroredChildReportIDs] of erroredChildReportIDsByChat) {
        const chatAttributes = reportAttributes[chatReportID];
        if (!chatAttributes) {
            continue;
        }

        const chatReportActions = reportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${chatReportID}`];
        const actionTargetReportActionID =
            getOldestPreviewActionID(chatReportID, erroredChildReportIDs, reports, chatReportActions, isActionable) ??
            getOldestPreviewActionID(chatReportID, childReportIDsByChat.get(chatReportID), reports, chatReportActions, (childReport) =>
                needsViolationFix(childReport, getLoginByAccountID(childReport?.ownerAccountID, personalDetails), policies, transactionViolations, currentUserAccountID, currentUserEmail),
            ) ??
            getOldestPreviewActionID(chatReportID, erroredChildReportIDs, reports, chatReportActions) ??
            chatAttributes.actionTargetReportActionID;

        updates[chatReportID] = {
            ...chatAttributes,
            brickRoadStatus: CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR,
            actionBadge: CONST.REPORT.ACTION_BADGE.FIX,
            actionTargetReportActionID,
        };
    }
    return updates;
}

/**
 * Builds the `getReportNameByID` for one compute pass. It computes the requested report's name from the same inputs
 * instead of reading the previous map, so the result does not depend on which report was computed first.
 */
function createReportNameLookup(inputs: ReportAttributesInputs, formatters: ReportAttributesFormatters): (reportID: string) => string | undefined {
    const names = new Map<string, string | undefined>();
    return (reportID) => {
        if (names.has(reportID)) {
            return names.get(reportID);
        }
        const report = inputs.reports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
        const name = report ? computeReportNameEntry(report, inputs, formatters, undefined) : undefined;
        names.set(reportID, name);
        return name;
    };
}

export {getParentChatPropagationUpdates, buildReportAttributesFormatters, computeReportNameEntry, createReportNameLookup, computeReportStatusEntry, getOldestPreviewActionID};
export type {ReportAttributesFormatters, ReportAttributesInputs, ReportStatusEntry};
