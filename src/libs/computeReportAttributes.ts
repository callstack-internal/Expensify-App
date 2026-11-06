/**
 * Computes the report attributes map (name, RBR/GBR status and action badge for every report) incrementally:
 * from the changed collection members it works out which reports need recomputing and reuses the rest of the
 * previous map.
 */

import CONST from '@src/CONST';
import type {OnyxKey} from '@src/ONYXKEYS';
import ONYXKEYS from '@src/ONYXKEYS';
import type {CardList, PersonalDetails, PersonalDetailsList, Policy, Report, ReportAttributesDerivedValue, Transaction} from '@src/types/onyx';
import type {ReportAttributes} from '@src/types/onyx/DerivedValues';
import type {Errors} from '@src/types/onyx/OnyxCommon';

import type {OnyxCollection, OnyxEntry, OnyxValue} from 'react-native-onyx';

import type {DerivedSourceValues} from './actions/OnyxDerived/types';
import type {ReportAttributesInputs} from './ReportAttributesComputeUtils';

import {hasKeyTriggeredCompute} from './actions/OnyxDerived/utils';
import {getIsOffline} from './NetworkState';
import {isPolicyFieldListEmpty} from './PolicyUtils';
import {getLinkedTransactionID, isActionableCardFraudAlert} from './ReportActionsUtils';
import {getParentChatPropagationUpdates, buildReportAttributesFormatters, computeReportNameEntry, computeReportStatusEntry, createReportNameLookup} from './ReportAttributesComputeUtils';
import {generateIsEmptyReport, isArchivedReport, isValidReport} from './ReportUtils';
import {buildTransactionsByReportID} from './TodosUtils';

const REPORT_ATTRIBUTES_DEPENDENCIES = [
    ONYXKEYS.COLLECTION.REPORT,
    ONYXKEYS.NVP_PREFERRED_LOCALE,
    ONYXKEYS.COUNTRY_CODE,
    ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS,
    ONYXKEYS.COLLECTION.REPORT_ACTIONS,
    ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS,
    ONYXKEYS.COLLECTION.TRANSACTION,
    ONYXKEYS.PERSONAL_DETAILS_LIST,
    ONYXKEYS.SESSION,
    ONYXKEYS.COLLECTION.POLICY,
    ONYXKEYS.COLLECTION.POLICY_TAGS,
    ONYXKEYS.CONCIERGE_REPORT_ID,
    ONYXKEYS.NVP_INTRO_SELECTED,
    ONYXKEYS.COLLECTION.REPORT_METADATA,
    ONYXKEYS.CURRENCY_LIST,
    ONYXKEYS.COLLECTION.RULE,
    ONYXKEYS.CARD_LIST,
    ONYXKEYS.NETWORK,
] as const;

type ReportAttributesDependencies = typeof REPORT_ATTRIBUTES_DEPENDENCIES;

// Mapping over a type parameter keeps the result a tuple; mapping over the concrete tuple type would not.
type DependencyValues<Dependencies extends readonly OnyxKey[]> = {
    -readonly [Index in keyof Dependencies]: OnyxValue<Dependencies[Index]>;
};

type ReportAttributesDependencyValues = DependencyValues<ReportAttributesDependencies>;

/** What changed since the previous compute: the changed collection members, and every dependency that changed. */
type ReportAttributesComputeContext = {
    currentValue?: ReportAttributesDerivedValue;
    sourceValues?: DerivedSourceValues<ReportAttributesDependencies>;
    triggeredKeys?: Set<OnyxKey>;
};

const RECOMPUTE_ALL = 'all' as const;

const prepareReportKeys = (keys: string[]) => {
    return [
        ...new Set(
            keys.map((key) =>
                key
                    .replace(ONYXKEYS.COLLECTION.REPORT_METADATA, ONYXKEYS.COLLECTION.REPORT)
                    .replace(ONYXKEYS.COLLECTION.REPORT_ACTIONS, ONYXKEYS.COLLECTION.REPORT)
                    .replace(ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS, ONYXKEYS.COLLECTION.REPORT),
            ),
        ),
    ];
};

const hasPolicyRelevantFieldChanged = (prev: Policy | null | undefined, next: Policy | null | undefined): boolean => {
    if (!prev && !next) {
        return false;
    }
    if (!prev || !next) {
        return true;
    }
    return (
        prev.type !== next.type ||
        prev.approvalMode !== next.approvalMode ||
        prev.reimbursementChoice !== next.reimbursementChoice ||
        prev.autoReimbursementLimit !== next.autoReimbursementLimit ||
        prev.role !== next.role ||
        prev.autoReimbursement?.limit !== next.autoReimbursement?.limit
    );
};

// A short string built from the fields a report name can come from: displayName and firstName.
const displayNameSignature = (details: PersonalDetails | null): string => JSON.stringify([details?.displayName ?? '', details?.firstName ?? '']);

const snapshotDisplayNames = (personalDetails: PersonalDetailsList): Record<string, string> => {
    const snapshot: Record<string, string> = {};
    for (const key of Object.keys(personalDetails)) {
        snapshot[key] = displayNameSignature(personalDetails[key]);
    }
    return snapshot;
};

// True when the report's name could depend on one of these accounts. We look at the accounts stored on the report itself.
const reportReferencesAccountIDs = (report: Report, accountIDs: Set<number>): boolean => {
    if (report.ownerAccountID !== undefined && accountIDs.has(report.ownerAccountID)) {
        return true;
    }
    if (report.managerID !== undefined && accountIDs.has(report.managerID)) {
        return true;
    }
    if (report.invoiceReceiver?.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.INDIVIDUAL && accountIDs.has(report.invoiceReceiver.accountID)) {
        return true;
    }
    for (const participantID of Object.keys(report.participants ?? {})) {
        if (accountIDs.has(Number(participantID))) {
            return true;
        }
    }
    return false;
};

// The errors are rebuilt on every compute, but their values are the messages stored on the report and its actions.
const areReportErrorsEqual = (previous: Errors, next: Errors): boolean => {
    const previousKeys = Object.keys(previous);
    return previousKeys.length === Object.keys(next).length && previousKeys.every((key) => key in next && previous[key] === next[key]);
};

// Compares every ReportAttributes field, so a field added to the type has to be added here too.
const areReportAttributesEqual = (previous: ReportAttributes, next: ReportAttributes): boolean =>
    previous.reportName === next.reportName &&
    previous.isEmpty === next.isEmpty &&
    previous.brickRoadStatus === next.brickRoadStatus &&
    previous.requiresAttention === next.requiresAttention &&
    previous.actionBadge === next.actionBadge &&
    previous.actionTargetReportActionID === next.actionTargetReportActionID &&
    previous.oneTransactionThreadReportID === next.oneTransactionThreadReportID &&
    previous.needsParentChatErrorPropagation === next.needsParentChatErrorPropagation &&
    areReportErrorsEqual(previous.reportErrors, next.reportErrors);

/**
 * Creates a compute function with its own baselines: the personal details, policies, transactions and cards it
 * saw last time, which tell it which reports a change touched. Each caller keeps its own so their diffs don't mix.
 */
function createReportAttributesComputer() {
    // The name-related fields we saw for each account last time, so we can spot which accounts changed.
    let previousDisplayNames: Record<string, string> = {};
    let previousPersonalDetails: OnyxEntry<PersonalDetailsList> | undefined;
    let previousPolicies: OnyxCollection<Policy>;
    let previousReportsTransactions: Record<string, Transaction[]> | undefined;
    let previousFraudAlertReportIDs: Set<string> | undefined;
    let previousCardList: OnyxEntry<CardList>;

    // Remembers the personal details we just used, so the next change can be compared against them.
    // Updating both fields together here keeps them from getting out of sync.
    const commitDisplayNamesBaseline = (personalDetails: OnyxEntry<PersonalDetailsList>, snapshot: Record<string, string>) => {
        previousDisplayNames = snapshot;
        previousPersonalDetails = personalDetails;
    };

    // Records the current names the first time we have them on a pass that wasn't itself a personal-details
    // change. The report names already match these names, so there's nothing to recompute — we just save them
    // so the next personal-details change can be compared and narrowed to the reports it actually affects.
    const seedDisplayNamesBaseline = (personalDetails: OnyxEntry<PersonalDetailsList>) => {
        if (!personalDetails || previousPersonalDetails === personalDetails || Object.keys(previousDisplayNames).length > 0) {
            return;
        }
        commitDisplayNamesBaseline(personalDetails, snapshotDisplayNames(personalDetails));
    };

    // Works out which accounts had a name change since last time. Returns the set of those accountIDs, or null
    // when nothing changed, or 'all' when there's no previous data to compare against yet and every report needs
    // refreshing.
    const getDisplayNameChanges = (personalDetails: OnyxEntry<PersonalDetailsList>): Set<number> | typeof RECOMPUTE_ALL | null => {
        if (!personalDetails) {
            return null;
        }

        if (previousPersonalDetails === personalDetails) {
            return null;
        }

        const hadBaseline = Object.keys(previousDisplayNames).length > 0;
        const nextSnapshot: Record<string, string> = {};
        const changedAccountIDs = new Set<number>();

        // Build the new snapshot and compare it against the old one in the same loop.
        for (const key of Object.keys(personalDetails)) {
            const signature = displayNameSignature(personalDetails[key]);
            nextSnapshot[key] = signature;
            if (hadBaseline && signature !== previousDisplayNames[key]) {
                changedAccountIDs.add(Number(key));
            }
        }
        // An account that existed before but is gone now also affects any report name that used it.
        if (hadBaseline) {
            for (const key of Object.keys(previousDisplayNames)) {
                if (!(key in nextSnapshot)) {
                    changedAccountIDs.add(Number(key));
                }
            }
        }

        commitDisplayNamesBaseline(personalDetails, nextSnapshot);

        if (!hadBaseline) {
            return Object.keys(nextSnapshot).length > 0 ? RECOMPUTE_ALL : null;
        }
        return changedAccountIDs.size > 0 ? changedAccountIDs : null;
    };

    function computeReportAttributes(
        [
            reports,
            preferredLocale,
            countryCodeByIP,
            transactionViolations,
            reportActions,
            reportNameValuePairs,
            transactions,
            personalDetails,
            session,
            policies,
            policyTags,
            conciergeReportID,
            introSelected,
            reportMetadata,
            currencyList,
            rules,
            cardList,
        ]: ReportAttributesDependencyValues,
        {currentValue, sourceValues, triggeredKeys}: ReportAttributesComputeContext,
    ): ReportAttributesDerivedValue {
        // Read the in-memory offline state directly (NETWORK is a dependency so recompute still fires when it changes).
        const isOffline = getIsOffline();
        // Check if display names changed when personal details are updated
        let displayNameChanges: Set<number> | typeof RECOMPUTE_ALL | null = null;
        if (hasKeyTriggeredCompute(ONYXKEYS.PERSONAL_DETAILS_LIST, triggeredKeys)) {
            displayNameChanges = getDisplayNameChanges(personalDetails);

            // Only short-circuit when personal details were the sole trigger; coalescing can batch them
            // with report/transaction changes, and returning early would drop those.
            const personalDetailsIsOnlyTrigger = triggeredKeys?.size === 1;
            if (!displayNameChanges && personalDetailsIsOnlyTrigger) {
                return currentValue ?? {reports: {}, locale: null};
            }
        } else if (!sourceValues) {
            previousDisplayNames = {};
            previousPersonalDetails = undefined;
        } else {
            // Save the current names now, so the first real name change can be narrowed to the reports it affects.
            seedDisplayNamesBaseline(personalDetails);
        }

        // Seed the policy value-baseline on the startup flush (policies from disk, no POLICY trigger). Without
        // it the first POLICY trigger has no baseline and treats every policy as changed. See getCollectionDelta.
        if (previousPolicies === undefined && policies && !hasKeyTriggeredCompute(ONYXKEYS.COLLECTION.POLICY, triggeredKeys)) {
            previousPolicies = policies;
        }

        // A full recompute is needed when locale changes (report names are locale-dependent) or display names change.
        // We compare preferredLocale against currentValue?.locale so that the first locale load on startup
        // (where both equal the same persisted value) does not trigger an unnecessary full recompute.
        const needsFullRecompute =
            (hasKeyTriggeredCompute(ONYXKEYS.NVP_PREFERRED_LOCALE, triggeredKeys) && preferredLocale !== currentValue?.locale) ||
            displayNameChanges === RECOMPUTE_ALL ||
            hasKeyTriggeredCompute(ONYXKEYS.CONCIERGE_REPORT_ID, triggeredKeys) ||
            hasKeyTriggeredCompute(ONYXKEYS.NVP_INTRO_SELECTED, triggeredKeys) ||
            // Amount-bearing report names format with the currency list's decimals/symbols, so names computed before
            // the list arrived (or with a stale list) must all be redone. This loads roughly once per session.
            hasKeyTriggeredCompute(ONYXKEYS.CURRENCY_LIST, triggeredKeys);

        const policyChangedReportKeys: string[] = [];
        // Reports whose policy change touched only fields that don't feed the report name (type, approvalMode,
        // role, etc.) — their name can't have changed, so they skip computeReportName and reuse the cached one.
        const nameSkipPolicyReportKeys: string[] = [];
        if (hasKeyTriggeredCompute(ONYXKEYS.COLLECTION.POLICY, triggeredKeys)) {
            if (!needsFullRecompute) {
                // Policy updated — only recompute reports whose relevant fields actually changed
                const changedPolicyIDs = new Set<string>();
                const nameChangedPolicyIDs = new Set<string>();
                const threadNameChangedPolicyIDs = new Set<string>();
                const emptyNameChangedPolicyIDs = new Set<string>();
                for (const key of Object.keys(sourceValues?.[ONYXKEYS.COLLECTION.POLICY] ?? {})) {
                    const prevPolicy = previousPolicies?.[key];
                    const nextPolicy = policies?.[key];
                    // `name`/`achAccount` feed report names but aren't in hasPolicyRelevantFieldChanged, so a
                    // name-only change (e.g. workspace rename) would be skipped and leave the cached name stale.
                    const nameChanged = prevPolicy?.name !== nextPolicy?.name || prevPolicy?.achAccount?.accountNumber !== nextPolicy?.achAccount?.accountNumber;
                    // `approvalMode`/`role` feed only thread names (shouldShowMarkAsDone, isPolicyAdmin) and
                    // `fieldList` emptiness only empty-named money-request reports (getMoneyRequestReportName).
                    // They must not disqualify the whole policy — mass flushes (e.g. the first OpenSearchPage
                    // delivers `fieldList` for every policy) would recompute every name again. The report loop
                    // below drops the skip only for the shapes that read them.
                    const threadNameChanged = prevPolicy?.approvalMode !== nextPolicy?.approvalMode || prevPolicy?.role !== nextPolicy?.role;
                    const emptyNameChanged = isPolicyFieldListEmpty(prevPolicy ?? undefined) !== isPolicyFieldListEmpty(nextPolicy ?? undefined);
                    if (!hasPolicyRelevantFieldChanged(prevPolicy, nextPolicy) && !nameChanged && !emptyNameChanged) {
                        continue;
                    }
                    const policyID = key.replace(ONYXKEYS.COLLECTION.POLICY, '');
                    changedPolicyIDs.add(policyID);
                    if (nameChanged) {
                        nameChangedPolicyIDs.add(policyID);
                    }
                    if (threadNameChanged) {
                        threadNameChangedPolicyIDs.add(policyID);
                    }
                    if (emptyNameChanged) {
                        emptyNameChangedPolicyIDs.add(policyID);
                    }
                }
                if (changedPolicyIDs.size > 0) {
                    for (const reportKey of Object.keys(reports ?? {})) {
                        const report = reports?.[reportKey];
                        if (!report) {
                            continue;
                        }
                        // An invoice follows its receiver workspace. The invoice room carries the receiver
                        // on itself; a child invoice report doesn't, so we read it from its parent room
                        // (chatReportID) — the same place computeReportName looks for the invoice name.
                        const ownReceiverPolicyID = report.invoiceReceiver && 'policyID' in report.invoiceReceiver ? report.invoiceReceiver.policyID : undefined;
                        const room = report.chatReportID ? reports?.[`${ONYXKEYS.COLLECTION.REPORT}${report.chatReportID}`] : undefined;
                        const roomReceiverPolicyID = room?.invoiceReceiver && 'policyID' in room.invoiceReceiver ? room.invoiceReceiver.policyID : undefined;
                        const receiverPolicyChanged =
                            (!!ownReceiverPolicyID && changedPolicyIDs.has(ownReceiverPolicyID)) || (!!roomReceiverPolicyID && changedPolicyIDs.has(roomReceiverPolicyID));

                        // The report's own policy — the sender workspace for an invoice.
                        if (report.policyID && changedPolicyIDs.has(report.policyID)) {
                            policyChangedReportKeys.push(reportKey);
                            // Reuse the cached name only when nothing the report's name reads has changed:
                            // receiver policy (invoices), `approvalMode`/`role` (threads), `fieldList`
                            // emptiness (empty-named money-request reports).
                            const isThreadNameAffected = threadNameChangedPolicyIDs.has(report.policyID) && !!report.parentReportActionID;
                            const isEmptyNameAffected =
                                emptyNameChangedPolicyIDs.has(report.policyID) && !report.reportName && (report.type === CONST.REPORT.TYPE.EXPENSE || report.type === CONST.REPORT.TYPE.IOU);
                            if (!nameChangedPolicyIDs.has(report.policyID) && !receiverPolicyChanged && !isThreadNameAffected && !isEmptyNameAffected) {
                                nameSkipPolicyReportKeys.push(reportKey);
                            }
                            continue;
                        }
                        if (receiverPolicyChanged) {
                            policyChangedReportKeys.push(reportKey);
                        }
                    }
                }
            }
            previousPolicies = policies;
        }

        // A card's live fraud decides the fraud alert green dot on the report its fraudAlertReportID points at.
        // Clearing possibleFraud drops that ID from the card, so the previous IDs are needed to refresh the report.
        const cardChangedReportKeys: string[] = [];

        const isFirstCompute = previousFraudAlertReportIDs === undefined;
        if (isFirstCompute) {
            // REPORT_ATTRIBUTES is persisted, so a stored fraud alert dot may come from older code or from before the fraud
            // was cleared, with no card pointing at its report anymore. A fraud alert dot stores the alert as its target action.
            previousFraudAlertReportIDs = new Set(
                Object.entries(currentValue?.reports ?? {})
                    .filter(
                        ([reportID, {requiresAttention, actionTargetReportActionID}]) =>
                            requiresAttention &&
                            !!actionTargetReportActionID &&
                            isActionableCardFraudAlert(reportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`]?.[actionTargetReportActionID]),
                    )
                    .map(([reportID]) => reportID),
            );
        }

        if (isFirstCompute || previousCardList !== cardList) {
            const fraudAlertReportIDs = new Set(
                Object.values(cardList ?? {}).flatMap((card) => {
                    const id = card?.nameValuePairs?.possibleFraud?.fraudAlertReportID;
                    return id ? [String(id)] : [];
                }),
            );
            for (const reportID of new Set([...(previousFraudAlertReportIDs ?? []), ...fraudAlertReportIDs])) {
                cardChangedReportKeys.push(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
            }
            previousFraudAlertReportIDs = fraudAlertReportIDs;
            previousCardList = cardList;
        }

        // Use incremental updates when currentValue is already populated and no full recompute is required.
        // If currentValue has no reports (fresh install or cleared storage), fall back to a full scan.
        const useIncrementalUpdates = !!currentValue?.reports && Object.keys(currentValue.reports).length > 0 && !needsFullRecompute;

        // if we already computed the report attributes and there is no new reports data, return the current value
        if ((useIncrementalUpdates && !sourceValues && cardChangedReportKeys.length === 0) || !reports) {
            return currentValue ?? {reports: {}, locale: null};
        }

        const reportUpdates = sourceValues?.[ONYXKEYS.COLLECTION.REPORT] ?? {};
        const reportMetadataUpdates = sourceValues?.[ONYXKEYS.COLLECTION.REPORT_METADATA] ?? {};
        const reportActionsUpdates = sourceValues?.[ONYXKEYS.COLLECTION.REPORT_ACTIONS] ?? {};
        const reportNameValuePairsUpdates = sourceValues?.[ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS] ?? {};
        const transactionsUpdates = sourceValues?.[ONYXKEYS.COLLECTION.TRANSACTION];
        const transactionViolationsUpdates = sourceValues?.[ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS];
        const policyTagsUpdates = sourceValues?.[ONYXKEYS.COLLECTION.POLICY_TAGS];

        let dataToIterate = Object.keys(reports);
        // check if there are any report-related updates

        const reportUpdatesRelatedToReportActions = new Set<string>();

        for (const actions of Object.values(reportActionsUpdates)) {
            if (!actions) {
                continue;
            }

            for (const reportAction of Object.values(actions)) {
                if (reportAction?.childReportID) {
                    reportUpdatesRelatedToReportActions.add(`${ONYXKEYS.COLLECTION.REPORT}${reportAction.childReportID}`);
                }
            }
        }

        // When only some accounts changed their name, refresh just the reports that use those accounts
        // Skipped when we're already refreshing everything (first load or a
        // locale change); in that case useIncrementalUpdates is false and the full scan below handles it.
        const personalDetailsChangedReportKeys: string[] = [];
        if (displayNameChanges instanceof Set && useIncrementalUpdates) {
            for (const reportKey of Object.keys(reports)) {
                const report = reports[reportKey];
                if (report && reportReferencesAccountIDs(report, displayNameChanges)) {
                    personalDetailsChangedReportKeys.push(reportKey);
                }
            }
        }

        // Sources that can move a report's name. A report pulled in purely by a name-irrelevant policy change is
        // absent here, so it keeps its cached name and skips the expensive computeReportName.
        const nonPolicyUpdates = [
            ...Object.keys(reportUpdates),
            ...Object.keys(reportMetadataUpdates),
            ...Object.keys(reportActionsUpdates),
            ...Object.keys(reportNameValuePairsUpdates),
            ...Array.from(reportUpdatesRelatedToReportActions),
            ...personalDetailsChangedReportKeys,
        ];

        const nameAndParentUpdates = [...nonPolicyUpdates, ...policyChangedReportKeys];
        const updates = [...nameAndParentUpdates, ...cardChangedReportKeys];

        // Keys that reuse their cached name. Starts as the name-irrelevant policy and card reports; every other change
        // source (report/action/nvp/personal-details updates here, transactions and policy tags below) deletes
        // its keys, so a report skips computeReportName only when a name-irrelevant change is its sole
        // reason to be here. Parent-chat enqueues don't delete: a child update never feeds the parent chat's own name.
        const nameRelevantPolicyReportKeys = new Set(policyChangedReportKeys);
        for (const key of nameSkipPolicyReportKeys) {
            nameRelevantPolicyReportKeys.delete(key);
        }
        const nameSkipKeys = new Set(
            prepareReportKeys([...nameSkipPolicyReportKeys, ...(useIncrementalUpdates ? cardChangedReportKeys.filter((key) => !nameRelevantPolicyReportKeys.has(key)) : [])]),
        );
        for (const key of prepareReportKeys(nonPolicyUpdates)) {
            nameSkipKeys.delete(key);
        }

        if (useIncrementalUpdates) {
            // if there are report-related updates, iterate over the updates
            if (updates.length > 0 || !!transactionsUpdates || !!transactionViolationsUpdates || !!policyTagsUpdates) {
                dataToIterate = [];
                if (updates.length > 0) {
                    dataToIterate = prepareReportKeys(updates);

                    // When an IOU report changes, we need to re-evaluate its parent chat report as well.
                    // A card's fraud alert dot only affects the report holding the alert, so card changes don't enqueue parents.
                    const parentChatReportIDsToUpdate = new Set<string>();
                    for (const reportKey of prepareReportKeys(nameAndParentUpdates)) {
                        const report = reports[reportKey];
                        if (report?.chatReportID && report.reportID !== report.chatReportID) {
                            parentChatReportIDsToUpdate.add(`${ONYXKEYS.COLLECTION.REPORT}${report.chatReportID}`);
                        }
                    }
                    if (parentChatReportIDsToUpdate.size > 0) {
                        dataToIterate.push(...Array.from(parentChatReportIDsToUpdate));
                    }
                }
                if (!!transactionsUpdates || !!transactionViolationsUpdates) {
                    let transactionReportIDs: string[] = [];
                    if (transactionsUpdates) {
                        transactionReportIDs = Object.values(transactionsUpdates).map((transaction) => `${ONYXKEYS.COLLECTION.REPORT}${transaction?.reportID}`);

                        const updatedTransactionIDs = new Set(Object.keys(transactionsUpdates).map((key) => key.replace(ONYXKEYS.COLLECTION.TRANSACTION, '')));
                        if (updatedTransactionIDs.size > 0) {
                            for (const report of Object.values(reports)) {
                                if (!report?.reportID || !report.parentReportID || !report.parentReportActionID) {
                                    continue;
                                }

                                const parentReportAction = reportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.parentReportID}`]?.[report.parentReportActionID];
                                const linkedTransactionID = getLinkedTransactionID(parentReportAction);
                                if (linkedTransactionID && updatedTransactionIDs.has(linkedTransactionID)) {
                                    transactionReportIDs.push(`${ONYXKEYS.COLLECTION.REPORT}${report.reportID}`);
                                }
                            }
                        }
                    }
                    // Also handle transaction violations updates by extracting transaction IDs and finding their reports
                    if (transactionViolationsUpdates) {
                        const violationTransactionIDs = Object.keys(transactionViolationsUpdates).map((key) => key.replace(ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS, ''));
                        const violationReportIDs = violationTransactionIDs
                            .map((transactionID) => transactions?.[`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`]?.reportID)
                            .filter(Boolean)
                            .map((reportID) => `${ONYXKEYS.COLLECTION.REPORT}${reportID}`);

                        // Also include chat reports for expense reports that have violations
                        const chatReportIDs = violationReportIDs
                            .map((reportKey) => reports?.[reportKey]?.chatReportID)
                            .filter(Boolean)
                            .map((chatReportID) => `${ONYXKEYS.COLLECTION.REPORT}${chatReportID}`);

                        transactionReportIDs = [...transactionReportIDs, ...violationReportIDs, ...chatReportIDs];
                    }

                    // A transaction change (e.g. a card expense going from pending to posted) can flip whether its
                    // expense report requires attention, but the to-do/GBR render on the parent workspace chat.
                    // Enqueue those parent chats too so their attributes don't stay stale after the transaction updates.
                    const transactionParentChatReportIDs = transactionReportIDs
                        .map((reportKey) => reports?.[reportKey]?.chatReportID)
                        .filter(Boolean)
                        .map((chatReportID) => `${ONYXKEYS.COLLECTION.REPORT}${chatReportID}`);

                    // Transactions feed thread/expense report names, so these keys must not skip the name recompute.
                    const transactionReportKeys = prepareReportKeys([...transactionReportIDs, ...transactionParentChatReportIDs]);
                    dataToIterate.push(...transactionReportKeys);
                    for (const key of transactionReportKeys) {
                        nameSkipKeys.delete(key);
                    }
                }
                if (policyTagsUpdates) {
                    const changedPolicyIDs = new Set(Object.keys(policyTagsUpdates).map((key) => key.replace(ONYXKEYS.COLLECTION.POLICY_TAGS, '')));
                    const affectedReportKeys: string[] = [];
                    for (const report of Object.values(reports)) {
                        if (!report?.policyID || !changedPolicyIDs.has(report.policyID)) {
                            continue;
                        }
                        affectedReportKeys.push(`${ONYXKEYS.COLLECTION.REPORT}${report.reportID}`);
                    }
                    // Policy tags feed thread names (computeReportName reads allPolicyTags), so no name skip here.
                    const policyTagsReportKeys = prepareReportKeys(affectedReportKeys);
                    dataToIterate.push(...policyTagsReportKeys);
                    for (const key of policyTagsReportKeys) {
                        nameSkipKeys.delete(key);
                    }
                }
            } else {
                // No updates to process, return current value to prevent unnecessary computation
                return currentValue ?? {reports: {}, locale: null};
            }
        }
        // Only regroup transactions by reportID when the TRANSACTION collection itself changed - this rebuild
        // otherwise re-runs over every transaction on every recompute (e.g. a REPORT_ACTIONS-only update),
        // even though the grouping it produces couldn't have changed. `!sourceValues` also forces a rebuild:
        // it signals a full recompute (e.g. Onyx.clear() on logout), and without it this cache would keep
        // serving the previous session's stale transaction groupings until a TRANSACTION update happened to fire.
        if (!previousReportsTransactions || !sourceValues || hasKeyTriggeredCompute(ONYXKEYS.COLLECTION.TRANSACTION, triggeredKeys)) {
            previousReportsTransactions = buildTransactionsByReportID(transactions);
        }
        const inputs: ReportAttributesInputs = {
            reports,
            reportActions,
            reportNameValuePairs,
            reportMetadata,
            transactions,
            transactionViolations,
            personalDetails,
            session,
            policies,
            policyTags,
            conciergeReportID,
            introSelected,
            rules,
            cardList,
            isOffline,
            reportsTransactions: previousReportsTransactions ?? {},
        };
        const formatters = buildReportAttributesFormatters(preferredLocale, countryCodeByIP, currencyList);
        const getReportNameByID = createReportNameLookup(inputs, formatters);

        let hasRemovedEntries = false;
        const reportAttributes = dataToIterate.reduce<ReportAttributesDerivedValue['reports']>(
            (acc, key) => {
                // source value sends partial data, so we need an entire report object to do computations
                const report = reports[key];

                if (!report || !isValidReport(report)) {
                    const reportID = key.replace(ONYXKEYS.COLLECTION.REPORT, '');
                    if (acc[reportID]) {
                        delete acc[reportID];
                        hasRemovedEntries = true;
                    }
                    return acc;
                }

                const isReportArchived = isArchivedReport(reportNameValuePairs?.[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${report.reportID}`]);
                const status = computeReportStatusEntry(report, inputs);
                // Skip computeReportName when the name can't have changed (see nameSkipKeys).
                const cachedName = currentValue?.reports?.[report.reportID]?.reportName;
                const canReuseCachedName = cachedName !== undefined && nameSkipKeys.has(key);

                acc[report.reportID] = {
                    reportName: canReuseCachedName ? cachedName : computeReportNameEntry(report, inputs, formatters, getReportNameByID),
                    isEmpty: generateIsEmptyReport(report, isReportArchived),
                    ...status,
                };

                return acc;
            },
            // A full recompute visits every report, so it starts empty: carrying the previous map over would keep entries
            // for reports deleted since it was computed.
            useIncrementalUpdates && currentValue?.reports ? {...currentValue.reports} : {},
        );

        // Propagate errors from IOU reports to their parent chat reports.
        const propagationUpdates = getParentChatPropagationUpdates(reportAttributes, inputs);
        Object.assign(reportAttributes, propagationUpdates);

        const locale = preferredLocale ?? null;
        if (!currentValue?.reports || currentValue.locale !== locale) {
            return {reports: reportAttributes, locale};
        }

        // Most writes (a read receipt, a draft) leave every attribute as it was. Keeping the previous entry objects, and
        // the previous map when none changed, lets every consumer skip its deep comparison of the whole map.
        const recomputedReportIDs = useIncrementalUpdates
            ? new Set([...dataToIterate.map((key) => key.replace(ONYXKEYS.COLLECTION.REPORT, '')), ...Object.keys(propagationUpdates)])
            : Object.keys(reportAttributes);
        let hasChanges = hasRemovedEntries || (!useIncrementalUpdates && Object.keys(currentValue.reports).length !== Object.keys(reportAttributes).length);
        for (const reportID of recomputedReportIDs) {
            const nextAttributes = reportAttributes[reportID];
            if (!nextAttributes) {
                continue;
            }
            const previousAttributes = currentValue.reports[reportID];
            if (previousAttributes && areReportAttributesEqual(previousAttributes, nextAttributes)) {
                reportAttributes[reportID] = previousAttributes;
            } else {
                hasChanges = true;
            }
        }
        if (!hasChanges) {
            return currentValue;
        }

        return {reports: reportAttributes, locale};
    }

    return computeReportAttributes;
}

export default createReportAttributesComputer;
export {hasPolicyRelevantFieldChanged, REPORT_ATTRIBUTES_DEPENDENCIES};
export type {ReportAttributesComputeContext, ReportAttributesDependencyValues};
