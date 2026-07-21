import type {OnyxCollection} from 'react-native-onyx';
import type {LocaleContextProps} from '@components/LocaleContextProvider';
import type {ReportsToDisplayInLHN} from '@hooks/useSidebarOrderedReports';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportNameValuePairs} from '@src/types/onyx';
import type {ReportAttributesDerivedValue} from '@src/types/onyx/DerivedValues';
import {isArchivedNonExpenseReport} from './ReportUtils';

const SIDEBAR_SECTIONS = ['pinned', 'errors', 'drafts', 'channels', 'dms', 'archived'] as const;

type SidebarSectionKey = (typeof SIDEBAR_SECTIONS)[number];

type SidebarSection = {
    key: SidebarSectionKey;
    reportIDs: string[];
    count: number;
    unreadCount: number;
    isCollapsed: boolean;
};

type SectionMembership = Record<SidebarSectionKey, string[]>;

type DisplayReport = ReportsToDisplayInLHN[string];

function isDirectMessage(report: DisplayReport): boolean {
    if (report.type !== CONST.REPORT.TYPE.CHAT) {
        return false;
    }
    return !report.chatType || report.chatType === CONST.REPORT.CHAT_TYPE.GROUP || report.chatType === CONST.REPORT.CHAT_TYPE.SELF_DM;
}

function classifyReport(report: DisplayReport, hasDraft: boolean, isArchived: boolean): SidebarSectionKey {
    if (report.isPinned || report.requiresAttention) {
        return 'pinned';
    }
    if (report.hasErrorsOtherThanFailedReceipt && !isArchived) {
        return 'errors';
    }
    if (hasDraft) {
        return 'drafts';
    }
    if (isArchived) {
        return 'archived';
    }
    if (isDirectMessage(report)) {
        return 'dms';
    }
    return 'channels';
}

function getSectionMembership(
    reportsToDisplay: ReportsToDisplayInLHN,
    hasDraftByReportID: Record<string, boolean> | undefined,
    reportNameValuePairs: OnyxCollection<ReportNameValuePairs> | undefined,
): SectionMembership {
    const membership: SectionMembership = {pinned: [], errors: [], drafts: [], channels: [], dms: [], archived: []};
    for (const report of Object.values(reportsToDisplay)) {
        if (!report?.reportID) {
            continue;
        }
        const rNVPs = reportNameValuePairs?.[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${report.reportID}`];
        const isArchived = isArchivedNonExpenseReport(report, !!rNVPs?.private_isArchived);
        membership[classifyReport(report, !!hasDraftByReportID?.[report.reportID], isArchived)].push(report.reportID);
    }
    return membership;
}

const NAME_SORTED_SECTIONS: SidebarSectionKey[] = ['pinned', 'errors', 'drafts'];

function sortSectionMembers(
    sectionKey: SidebarSectionKey,
    memberIDs: string[],
    reportsToDisplay: ReportsToDisplayInLHN,
    reportAttributes: ReportAttributesDerivedValue['reports'] | undefined,
    localeCompare: LocaleContextProps['localeCompare'],
): string[] {
    if (NAME_SORTED_SECTIONS.includes(sectionKey)) {
        return [...memberIDs].sort((a, b) => localeCompare(reportAttributes?.[a]?.reportName ?? '', reportAttributes?.[b]?.reportName ?? ''));
    }
    return [...memberIDs].sort((a, b) => {
        const dateA = reportsToDisplay[`${ONYXKEYS.COLLECTION.REPORT}${a}`]?.lastVisibleActionCreated ?? '';
        const dateB = reportsToDisplay[`${ONYXKEYS.COLLECTION.REPORT}${b}`]?.lastVisibleActionCreated ?? '';
        return dateB < dateA ? -1 : Number(dateB > dateA);
    });
}

function countUnreadReports(memberIDs: string[], reportsToDisplay: ReportsToDisplayInLHN): number {
    let count = 0;
    for (const reportID of memberIDs) {
        const report = reportsToDisplay[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
        if (report?.lastReadTime && report.lastVisibleActionCreated && report.lastReadTime < report.lastVisibleActionCreated) {
            count++;
        }
    }
    return count;
}

export {SIDEBAR_SECTIONS, getSectionMembership, sortSectionMembers, countUnreadReports};
export type {SidebarSectionKey, SidebarSection};
