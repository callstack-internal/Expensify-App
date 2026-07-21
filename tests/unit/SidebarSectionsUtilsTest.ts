import type {OnyxCollection} from 'react-native-onyx';
import type {ReportsToDisplayInLHN} from '@hooks/useSidebarOrderedReports';
import {countUnreadReports, getSectionMembership, sortSectionMembers} from '@libs/SidebarSectionsUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportNameValuePairs} from '@src/types/onyx';

type DisplayReport = ReportsToDisplayInLHN[string];

function buildReport(reportID: string, extra: Partial<DisplayReport> = {}): DisplayReport {
    return {
        reportID,
        type: CONST.REPORT.TYPE.CHAT,
        lastVisibleActionCreated: '2026-07-01 00:00:00.000',
        ...extra,
    } as DisplayReport;
}

function buildDisplayMap(reports: DisplayReport[]): ReportsToDisplayInLHN {
    const map: ReportsToDisplayInLHN = {};
    for (const report of reports) {
        map[`${ONYXKEYS.COLLECTION.REPORT}${report.reportID}`] = report;
    }
    return map;
}

const localeCompare = (a: string, b: string) => a.localeCompare(b);

describe('getSectionMembership', () => {
    it('classifies each report into exactly one section, first match wins', () => {
        const reports = buildDisplayMap([
            buildReport('1', {isPinned: true}),
            buildReport('2', {requiresAttention: true}),
            buildReport('3', {hasErrorsOtherThanFailedReceipt: true}),
            buildReport('4'),
            buildReport('5', {chatType: CONST.REPORT.CHAT_TYPE.GROUP}),
            buildReport('6', {chatType: CONST.REPORT.CHAT_TYPE.POLICY_ROOM}),
            buildReport('7', {type: CONST.REPORT.TYPE.EXPENSE}),
        ]);
        const membership = getSectionMembership(reports, {4: false}, undefined);

        expect(membership.pinned.sort()).toEqual(['1', '2']);
        expect(membership.errors).toEqual(['3']);
        expect(membership.dms.sort()).toEqual(['4', '5']);
        expect(membership.channels.sort()).toEqual(['6', '7']);
        expect(membership.drafts).toEqual([]);
        expect(membership.archived).toEqual([]);
    });

    it('pinned beats draft, draft beats section type', () => {
        const reports = buildDisplayMap([buildReport('1', {isPinned: true}), buildReport('2')]);
        const membership = getSectionMembership(reports, {1: true, 2: true}, undefined);

        expect(membership.pinned).toEqual(['1']);
        expect(membership.drafts).toEqual(['2']);
    });

    it('archived chat goes to archived and suppresses its errors', () => {
        const rNVPs: OnyxCollection<ReportNameValuePairs> = {
            [`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}1`]: {private_isArchived: '2026-07-01 00:00:00.000'} as ReportNameValuePairs,
        };
        const reports = buildDisplayMap([buildReport('1', {hasErrorsOtherThanFailedReceipt: true})]);
        const membership = getSectionMembership(reports, undefined, rNVPs);

        expect(membership.archived).toEqual(['1']);
        expect(membership.errors).toEqual([]);
    });
});

describe('sortSectionMembers', () => {
    it('sorts pinned/errors/drafts by report name from attributes', () => {
        const reports = buildDisplayMap([buildReport('1'), buildReport('2')]);
        const attributes = {
            1: {reportName: 'Zulu'},
            2: {reportName: 'Alpha'},
        };

        expect(sortSectionMembers('pinned', ['1', '2'], reports, attributes as never, localeCompare)).toEqual(['2', '1']);
    });

    it('sorts channels/dms by lastVisibleActionCreated descending', () => {
        const reports = buildDisplayMap([buildReport('1', {lastVisibleActionCreated: '2026-07-01 00:00:00.000'}), buildReport('2', {lastVisibleActionCreated: '2026-07-02 00:00:00.000'})]);

        expect(sortSectionMembers('dms', ['1', '2'], reports, undefined, localeCompare)).toEqual(['2', '1']);
    });
});

describe('countUnreadReports', () => {
    it('counts reports whose lastReadTime is behind lastVisibleActionCreated', () => {
        const reports = buildDisplayMap([
            buildReport('1', {lastReadTime: '2026-06-30 00:00:00.000', lastVisibleActionCreated: '2026-07-01 00:00:00.000'}),
            buildReport('2', {lastReadTime: '2026-07-01 00:00:00.000', lastVisibleActionCreated: '2026-07-01 00:00:00.000'}),
        ]);

        expect(countUnreadReports(['1', '2'], reports)).toBe(1);
    });
});
