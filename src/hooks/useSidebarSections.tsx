import React, {createContext, useContext, useState} from 'react';
import {countUnreadReports, getSectionMembership, SIDEBAR_SECTIONS, sortSectionMembers} from '@libs/SidebarSectionsUtils';
import type {SidebarSection, SidebarSectionKey} from '@libs/SidebarSectionsUtils';
import SidebarUtils from '@libs/SidebarUtils';
import type {BrickRoad} from '@libs/WorkspacesSettingsUtils';
import {getChatTabBrickRoad} from '@libs/WorkspacesSettingsUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import {useCurrentReportIDState} from './useCurrentReportID';
import useCurrentUserPersonalDetails from './useCurrentUserPersonalDetails';
import useLocalize from './useLocalize';
import useNetwork from './useNetwork';
import useOnyx from './useOnyx';
import useReportAttributes from './useReportAttributes';

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

function SidebarSectionsContextProvider({children}: {children: React.ReactNode}) {
    const {localeCompare} = useLocalize();
    const [chatReports] = useOnyx(ONYXKEYS.COLLECTION.REPORT);
    const [transactions] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION);
    const [transactionViolations] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS);
    const [reportNameValuePairs] = useOnyx(ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS);
    const [reportsDrafts] = useOnyx(ONYXKEYS.COLLECTION.REPORT_DRAFT_COMMENT);
    const [betas] = useOnyx(ONYXKEYS.BETAS);
    const reportAttributes = useReportAttributes();
    const {isOffline} = useNetwork();
    const {accountID, login: currentUserLogin} = useCurrentUserPersonalDetails();
    const {currentReportID} = useCurrentReportIDState();
    const [collapsedSections, setCollapsedSections] = useState<Partial<Record<SidebarSectionKey, boolean>>>({archived: true});

    const reportsToDisplay = SidebarUtils.getReportsToDisplayInLHN({
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
