import {computeReportName} from '@libs/ReportNameUtils';
import {createLazyOnyxDerivedValueConfig} from '@userActions/OnyxDerived/createOnyxDerivedValueConfig';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

export default createLazyOnyxDerivedValueConfig({
    key: ONYXKEYS.DERIVED.REPORT_NAME,
    lazy: true,
    dependencies: [
        ONYXKEYS.COLLECTION.REPORT,
        ONYXKEYS.COLLECTION.POLICY,
        ONYXKEYS.COLLECTION.TRANSACTION,
        ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS,
        ONYXKEYS.PERSONAL_DETAILS_LIST,
        ONYXKEYS.COLLECTION.REPORT_ACTIONS,
        ONYXKEYS.SESSION,
        ONYXKEYS.NVP_PREFERRED_LOCALE,
    ],

    getInvalidatedItems: (changedDependencyKey, sourceValues) => {
        // Non-collection keys (personal details, session, locale) affect all report names
        if (
            changedDependencyKey === ONYXKEYS.SESSION ||
            changedDependencyKey === ONYXKEYS.PERSONAL_DETAILS_LIST ||
            changedDependencyKey === ONYXKEYS.NVP_PREFERRED_LOCALE
        ) {
            return undefined;
        }

        if (!sourceValues) {
            return undefined;
        }

        const itemKeys = new Set<string>();
        const collectionPrefixes = [
            ONYXKEYS.COLLECTION.REPORT,
            ONYXKEYS.COLLECTION.REPORT_ACTIONS,
            ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS,
            ONYXKEYS.COLLECTION.TRANSACTION,
        ] as const;

        for (const [depKey, changedItems] of Object.entries(sourceValues)) {
            if (!changedItems || typeof changedItems !== 'object') {
                continue;
            }

            // Policy changes don't directly map to reportIDs, invalidate all
            if (depKey === ONYXKEYS.COLLECTION.POLICY) {
                return undefined;
            }

            // For transaction changes, we can't easily map to report IDs from here, invalidate all
            if (depKey === ONYXKEYS.COLLECTION.TRANSACTION) {
                return undefined;
            }

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

        return itemKeys.size > 0 ? itemKeys : undefined;
    },

    computeItem: (reportID, [allReports, allPolicies, allTransactions, allReportNVPs, personalDetailsList, allReportActions, session]) => {
        const report = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
        if (!report) {
            return '';
        }

        return computeReportName(
            report,
            allReports,
            allPolicies,
            allTransactions,
            allReportNVPs,
            personalDetailsList ?? undefined,
            allReportActions,
            session?.accountID ?? CONST.DEFAULT_NUMBER_ID,
        );
    },
});
