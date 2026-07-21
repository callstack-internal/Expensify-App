import React, {createContext, useContext, useEffect, useState} from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import {countUnreadReports, getSectionMembership, SIDEBAR_SECTIONS, sortSectionMembers} from '@libs/SidebarSectionsUtils';
import type {SidebarSection, SidebarSectionKey} from '@libs/SidebarSectionsUtils';
import SidebarUtils from '@libs/SidebarUtils';
import type {BrickRoad} from '@libs/WorkspacesSettingsUtils';
import {getChatTabBrickRoad} from '@libs/WorkspacesSettingsUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import {useCurrentReportIDState} from './useCurrentReportID';
import useCurrentUserPersonalDetails from './useCurrentUserPersonalDetails';
import useLocalize from './useLocalize';
import useMappedPolicies from './useMappedPolicies';
import useNetwork from './useNetwork';
import useOnyx from './useOnyx';
import usePrevious from './usePrevious';
import useReportAttributes from './useReportAttributes';
import type {ReportsToDisplayInLHN} from './useSidebarOrderedReports';

type PartialPolicyForSidebar = Pick<OnyxTypes.Policy, 'type' | 'name' | 'avatarURL' | 'employeeList'>;

type SidebarSectionsStateValue = {
    sections: SidebarSection[];
    currentReportID: string | undefined;
    chatTabBrickRoad: BrickRoad;
};

type SidebarSectionsActionsValue = {
    toggleSection: (key: SidebarSectionKey) => void;
};

const SidebarSectionsStateContext = createContext<SidebarSectionsStateValue>({
    sections: [],
    currentReportID: undefined,
    chatTabBrickRoad: undefined,
});

const SidebarSectionsActionsContext = createContext<SidebarSectionsActionsValue>({
    toggleSection: () => {},
});

const policyMapper = (policy: OnyxEntry<OnyxTypes.Policy>): PartialPolicyForSidebar =>
    (policy && {
        type: policy.type,
        name: policy.name,
        avatarURL: policy.avatarURL,
        employeeList: policy.employeeList,
    }) as PartialPolicyForSidebar;

function SidebarSectionsContextProvider({children}: {children: React.ReactNode}) {
    const {localeCompare} = useLocalize();
    const [chatReports, {sourceValue: reportUpdates}] = useOnyx(ONYXKEYS.COLLECTION.REPORT);
    const [, {sourceValue: policiesUpdates}] = useMappedPolicies(policyMapper);
    const [transactions, {sourceValue: transactionsUpdates}] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION);
    const [transactionViolations, {sourceValue: transactionViolationsUpdates}] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS);
    const [reportNameValuePairs, {sourceValue: reportNameValuePairsUpdates}] = useOnyx(ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS);
    const [reportsDrafts, {sourceValue: reportsDraftsUpdates}] = useOnyx(ONYXKEYS.COLLECTION.REPORT_DRAFT_COMMENT);
    const [betas] = useOnyx(ONYXKEYS.BETAS);
    const reportAttributes = useReportAttributes();
    const {isOffline} = useNetwork();
    const {accountID, login: currentUserLogin} = useCurrentUserPersonalDetails();
    const {currentReportID} = useCurrentReportIDState();
    const prevCurrentReportID = usePrevious(currentReportID);
    const prevBetas = usePrevious(betas);
    const prevIsOffline = usePrevious(isOffline);
    const [displayCache, setDisplayCache] = useState<ReportsToDisplayInLHN>({});
    const [collapsedSections, setCollapsedSections] = useState<Partial<Record<SidebarSectionKey, boolean>>>({archived: true});

    const updatedReportKeys = new Set<string>();
    if (betas !== prevBetas || isOffline !== prevIsOffline) {
        for (const key of Object.keys(chatReports ?? {})) {
            updatedReportKeys.add(key);
        }
    }
    for (const key of Object.keys(reportUpdates ?? {})) {
        updatedReportKeys.add(key);
    }
    for (const key of Object.keys(reportNameValuePairsUpdates ?? {})) {
        updatedReportKeys.add(key.replace(ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS, ONYXKEYS.COLLECTION.REPORT));
    }
    for (const transaction of Object.values(transactionsUpdates ?? {})) {
        updatedReportKeys.add(`${ONYXKEYS.COLLECTION.REPORT}${transaction?.reportID}`);
    }
    for (const violationKey of Object.keys(transactionViolationsUpdates ?? {})) {
        const transactionKey = violationKey.replace(ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS, ONYXKEYS.COLLECTION.TRANSACTION);
        updatedReportKeys.add(`${ONYXKEYS.COLLECTION.REPORT}${transactions?.[transactionKey]?.reportID}`);
    }
    for (const key of Object.keys(reportsDraftsUpdates ?? {})) {
        updatedReportKeys.add(key.replace(ONYXKEYS.COLLECTION.REPORT_DRAFT_COMMENT, ONYXKEYS.COLLECTION.REPORT));
    }
    if (policiesUpdates) {
        const updatedPolicies = new Set(Object.keys(policiesUpdates).map((policyKey) => policyKey.replace(ONYXKEYS.COLLECTION.POLICY, '')));
        for (const [reportKey, report] of Object.entries(chatReports ?? {})) {
            if (!report?.policyID || !updatedPolicies.has(report.policyID)) {
                continue;
            }
            updatedReportKeys.add(reportKey);
        }
    }
    if (prevCurrentReportID !== currentReportID) {
        updatedReportKeys.add(`${ONYXKEYS.COLLECTION.REPORT}${prevCurrentReportID}`);
        updatedReportKeys.add(`${ONYXKEYS.COLLECTION.REPORT}${currentReportID}`);
    }

    const hasCache = Object.keys(displayCache).length > 0;
    const effectiveUpdatedKeys = updatedReportKeys.size === 0 && hasCache ? Object.keys(displayCache) : Array.from(updatedReportKeys);
    const reportsToDisplay =
        effectiveUpdatedKeys.length > 0 && hasCache
            ? SidebarUtils.updateReportsToDisplayInLHN({
                  displayedReports: displayCache,
                  reports: chatReports,
                  updatedReportsKeys: effectiveUpdatedKeys,
                  currentReportId: currentReportID,
                  isInFocusMode: false,
                  betas,
                  transactionViolations,
                  reportNameValuePairs,
                  reportAttributes,
                  draftComments: reportsDrafts,
                  transactions,
                  isOffline,
                  currentUserLogin: currentUserLogin ?? '',
                  currentUserAccountID: accountID,
              })
            : SidebarUtils.getReportsToDisplayInLHN({
                  currentReportId: currentReportID,
                  reports: chatReports,
                  betas,
                  priorityMode: CONST.PRIORITY_MODE.DEFAULT,
                  draftComments: reportsDrafts,
                  transactionViolations,
                  transactions,
                  isOffline,
                  currentUserLogin: currentUserLogin ?? '',
                  currentUserAccountID: accountID,
                  reportNameValuePairs,
                  reportAttributes,
              });

    useEffect(() => {
        setDisplayCache(reportsToDisplay);
    }, [reportsToDisplay]);

    const hasDraftByReportID: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(reportsDrafts ?? {})) {
        if (value) {
            hasDraftByReportID[key.replace(ONYXKEYS.COLLECTION.REPORT_DRAFT_COMMENT, '')] = true;
        }
    }

    const membership = getSectionMembership(reportsToDisplay, hasDraftByReportID, reportNameValuePairs);

    const sections = SIDEBAR_SECTIONS.map((key): SidebarSection => {
        const memberIDs = membership[key];
        const isCollapsed = !!collapsedSections[key];
        return {
            key,
            isCollapsed,
            count: memberIDs.length,
            unreadCount: isCollapsed ? countUnreadReports(memberIDs, reportsToDisplay) : 0,
            reportIDs: isCollapsed ? [] : sortSectionMembers(key, memberIDs, reportsToDisplay, reportAttributes, localeCompare),
        };
    });

    const allVisibleReportIDs = Object.keys(reportsToDisplay).map((key) => key.replace(ONYXKEYS.COLLECTION.REPORT, ''));

    const stateValue: SidebarSectionsStateValue = {
        sections,
        currentReportID,
        chatTabBrickRoad: getChatTabBrickRoad(allVisibleReportIDs, reportAttributes),
    };

    const toggleSection = (key: SidebarSectionKey) => {
        setCollapsedSections((current) => ({...current, [key]: !current[key]}));
    };

    const actionsValue: SidebarSectionsActionsValue = {toggleSection};

    return (
        <SidebarSectionsStateContext.Provider value={stateValue}>
            <SidebarSectionsActionsContext.Provider value={actionsValue}>{children}</SidebarSectionsActionsContext.Provider>
        </SidebarSectionsStateContext.Provider>
    );
}

function useSidebarSectionsState() {
    return useContext(SidebarSectionsStateContext);
}

function useSidebarSectionsActions() {
    return useContext(SidebarSectionsActionsContext);
}

export {SidebarSectionsContextProvider, useSidebarSectionsState, useSidebarSectionsActions};
