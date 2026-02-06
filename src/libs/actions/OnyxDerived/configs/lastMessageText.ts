import type {OnyxEntry} from 'react-native-onyx';
import {translateLocal} from '@libs/Localize';
import {getMovedReportID} from '@libs/ModifiedExpenseMessage';
import {getLastMessageTextForReport} from '@libs/OptionsListUtils';
import {getSortedReportActionsForDisplay} from '@libs/ReportActionsUtils';
import {canUserPerformWriteAction} from '@libs/ReportUtils';
import {createLazyOnyxDerivedValueConfig} from '@userActions/OnyxDerived/createOnyxDerivedValueConfig';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {PersonalDetails, PersonalDetailsList, Policy, Report, ReportActions, ReportMetadata, ReportNameValuePairs} from '@src/types/onyx';

function getLastActorDetails(report: OnyxEntry<Report>, personalDetails: OnyxEntry<PersonalDetailsList>, lastReportAction: OnyxEntry<ReportActions[string]>) {
    let lastActorDetails: Partial<PersonalDetails> | null =
        report?.lastActorAccountID && personalDetails?.[report.lastActorAccountID] ? (personalDetails[report.lastActorAccountID] ?? null) : null;

    if (!lastActorDetails && lastReportAction) {
        const lastActorDisplayName = lastReportAction?.person?.[0]?.text;
        lastActorDetails = lastActorDisplayName
            ? {
                  displayName: lastActorDisplayName,
                  accountID: report?.lastActorAccountID,
              }
            : null;
    }

    return lastActorDetails;
}

export default createLazyOnyxDerivedValueConfig({
    key: ONYXKEYS.DERIVED.LAST_MESSAGE_TEXT,
    lazy: true,
    dependencies: [
        ONYXKEYS.COLLECTION.REPORT,
        ONYXKEYS.COLLECTION.REPORT_ACTIONS,
        ONYXKEYS.COLLECTION.POLICY,
        ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS,
        ONYXKEYS.COLLECTION.REPORT_METADATA,
        ONYXKEYS.PERSONAL_DETAILS_LIST,
        ONYXKEYS.SESSION,
    ],

    getInvalidatedItems: (changedDependencyKey, sourceValues) => {
        // Non-collection keys affect all reports
        if (changedDependencyKey === ONYXKEYS.SESSION || changedDependencyKey === ONYXKEYS.PERSONAL_DETAILS_LIST) {
            return undefined;
        }

        // For collection keys, extract affected reportIDs from source values.
        // sourceValues has the shape: { collectionPrefix: { "prefix_ID": value } }
        // We need to extract the IDs from the nested keys.
        if (sourceValues) {
            const itemKeys = new Set<string>();
            const collectionPrefixes = [
                ONYXKEYS.COLLECTION.REPORT,
                ONYXKEYS.COLLECTION.REPORT_ACTIONS,
                ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS,
                ONYXKEYS.COLLECTION.REPORT_METADATA,
            ] as const;

            for (const [depKey, changedItems] of Object.entries(sourceValues)) {
                if (!changedItems || typeof changedItems !== 'object') {
                    continue;
                }

                // Policy changes don't directly map to reportIDs, invalidate all
                if (depKey === ONYXKEYS.COLLECTION.POLICY) {
                    return undefined;
                }

                // For other collection keys, extract IDs from the changed items
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                for (const fullKey of Object.keys(changedItems)) {
                    for (const prefix of collectionPrefixes) {
                        if (fullKey.startsWith(prefix)) {
                            itemKeys.add(fullKey.replace(prefix, ''));
                            break;
                        }
                    }
                }
            }

            if (itemKeys.size > 0) {
                return itemKeys;
            }
        }

        // Fallback: invalidate all
        return undefined;
    },

    computeItem: (reportID, [allReports, allReportActions, allPolicies, allReportNameValuePairs, allReportMetadata, personalDetailsList, session]) => {
        const report = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
        if (!report) {
            return '';
        }

        const itemReportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`];
        const itemPolicy: OnyxEntry<Policy> = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report.policyID}`];
        const itemReportNameValuePairs: OnyxEntry<ReportNameValuePairs> = allReportNameValuePairs?.[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${reportID}`];
        const itemReportMetadata: OnyxEntry<ReportMetadata> = allReportMetadata?.[`${ONYXKEYS.COLLECTION.REPORT_METADATA}${reportID}`];
        const currentUserAccountID = session?.accountID ?? CONST.DEFAULT_NUMBER_ID;
        const isReportArchived = !!itemReportNameValuePairs?.private_isArchived;
        const canUserPerformWrite = canUserPerformWriteAction(report, isReportArchived);
        const sortedReportActions = getSortedReportActionsForDisplay(itemReportActions, canUserPerformWrite);
        const lastReportAction = sortedReportActions.at(0);

        const lastActorDetails = getLastActorDetails(report, personalDetailsList, lastReportAction);
        const movedFromReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${getMovedReportID(lastReportAction, CONST.REPORT.MOVE_TYPE.FROM)}`];
        const movedToReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${getMovedReportID(lastReportAction, CONST.REPORT.MOVE_TYPE.TO)}`];

        return getLastMessageTextForReport({
            translate: translateLocal,
            report,
            lastActorDetails,
            movedFromReport,
            movedToReport,
            policy: itemPolicy,
            isReportArchived,
            reportMetadata: itemReportMetadata,
            currentUserAccountID,
        });
    },
});
