import {act, renderHook} from '@testing-library/react-native';

import {SearchQueryContext} from '@components/Search/SearchContextDefinitions';
import {SearchScopeProvider} from '@components/Search/SearchScopeProvider';

import useReportIDToNameMap, {buildMentionedRoomPlaceholderMap, buildReportIDToNameMap, getMentionedReportIDs, getReportIDToNameMapForRoomsInMarkdown} from '@hooks/useReportIDToNameMap';

import ONYXKEYS from '@src/ONYXKEYS';
import type {Report} from '@src/types/onyx';
import type ChildrenProps from '@src/types/utils/ChildrenProps';

import type {OnyxCollection} from 'react-native-onyx';

import React, {use, useMemo} from 'react';
import Onyx from 'react-native-onyx';

import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';

function createReport(reportID: string, overrides: Partial<Report> = {}): Report {
    return {
        reportID,
        reportName: `Report ${reportID}`,
        ...overrides,
    } as Report;
}

const REPORT_ID = '1';
const REPORT_KEY = `${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}` as const;
const SEARCH_HASH = 42;
const SNAPSHOT_KEY = `${ONYXKEYS.COLLECTION.SNAPSHOT}${SEARCH_HASH}` as const;

function SearchScreen({children}: ChildrenProps) {
    const queryContext = use(SearchQueryContext);
    const queryContextWithHash = useMemo(() => ({...queryContext, currentSearchHash: SEARCH_HASH}), [queryContext]);

    return (
        <SearchScopeProvider isOnSearch>
            <SearchQueryContext.Provider value={queryContextWithHash}>{children}</SearchQueryContext.Provider>
        </SearchScopeProvider>
    );
}

const renderReportIDToNameMap = async (wrapper?: React.ComponentType<ChildrenProps>) => {
    const hook = renderHook(() => useReportIDToNameMap(), {wrapper});
    await act(async () => {
        await waitForBatchedUpdates();
    });
    return hook;
};

describe('useReportIDToNameMap', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        await Onyx.clear();
        await waitForBatchedUpdates();
    });

    it('returns an empty object when reports are not set', async () => {
        const {result} = await renderReportIDToNameMap();
        expect(result.current).toEqual({});
    });

    it('maps reportID to reportName when reportName is present', async () => {
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}1`, createReport('1', {reportName: 'Expense Report'}));
        const {result} = await renderReportIDToNameMap();
        expect(result.current['1']).toBe('Expense Report');
    });

    it('falls back to reportID when reportName is undefined', async () => {
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}2`, createReport('2', {reportName: undefined}));
        const {result} = await renderReportIDToNameMap();
        expect(result.current['2']).toBe('2');
    });

    it('maps multiple reports and skips null entries', async () => {
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}10`, createReport('10', {reportName: 'Trip Report'}));
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}11`, createReport('11', {reportName: undefined}));
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}12`, null);

        const {result} = await renderReportIDToNameMap();

        expect(result.current['10']).toBe('Trip Report');
        expect(result.current['11']).toBe('11');
        expect(result.current['12']).toBeUndefined();
    });

    it('reflects updates to reports', async () => {
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}1`, createReport('1', {reportName: 'Old Name'}));
        const {result} = await renderReportIDToNameMap();
        expect(result.current['1']).toBe('Old Name');

        await act(async () => {
            await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}1`, {reportName: 'New Name'});
            await waitForBatchedUpdates();
        });

        expect(result.current['1']).toBe('New Name');
    });

    it('keeps a stable reference across re-renders when reports do not change', async () => {
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}1`, createReport('1', {reportName: 'Stable'}));
        const {result, rerender} = await renderReportIDToNameMap();
        const firstResult = result.current;

        rerender({});
        await act(async () => {
            await waitForBatchedUpdates();
        });

        expect(result.current).toBe(firstResult);
    });

    it('should keep the same map when a report write does not change any name', async () => {
        // Given a mounted map over two reports
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}1`, createReport('1', {reportName: 'First'}));
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}2`, createReport('2', {reportName: 'Second'}));
        const {result} = await renderReportIDToNameMap();
        const firstResult = result.current;

        // When a report gets a new message, which touches the report but not its name
        await act(async () => {
            await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}1`, {lastMessageText: 'hello'});
            await waitForBatchedUpdates();
        });

        // Then consumers keep the same map, so sending a message does not re-render the composer through it
        expect(result.current).toBe(firstResult);
    });

    it('should drop a report from the map when it is removed', async () => {
        // Given a mounted map over two reports
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}1`, createReport('1', {reportName: 'First'}));
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}2`, createReport('2', {reportName: 'Second'}));
        const {result} = await renderReportIDToNameMap();

        // When one report is removed, which changes no remaining name
        await act(async () => {
            await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}2`, null);
            await waitForBatchedUpdates();
        });

        // Then the removed report leaves the map, because removals count as a change
        expect(result.current).toEqual({[REPORT_ID]: 'First'});
    });

    it('should give two consumers of the same reports the same map, before and after a name change', async () => {
        // Given two mounted consumers of the live reports
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}1`, createReport('1', {reportName: 'Old Name'}));
        const {result: firstConsumer} = await renderReportIDToNameMap();
        const {result: secondConsumer} = await renderReportIDToNameMap();
        const mapBeforeRename = firstConsumer.current;

        // When a report is renamed
        await act(async () => {
            await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}1`, {reportName: 'New Name'});
            await waitForBatchedUpdates();
        });

        // Then both consumers share one map each time, because the map is built once per collection and not once per consumer
        expect(secondConsumer.current).toBe(firstConsumer.current);
        expect(firstConsumer.current).toEqual({[REPORT_ID]: 'New Name'});
        expect(mapBeforeRename).toEqual({[REPORT_ID]: 'Old Name'});
    });

    it('should build the map from the snapshot reports inside Search', async () => {
        // Given two live reports and a Search snapshot that holds one of them under another name
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}1`, createReport('1', {reportName: 'Live name'}));
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}2`, createReport('2', {reportName: 'Live only'}));
        await Onyx.merge(SNAPSHOT_KEY, {data: {[REPORT_KEY]: createReport('1', {reportName: 'Snapshot name'})}});

        // When the map is read on a Search screen
        const {result} = await renderReportIDToNameMap(SearchScreen);

        // Then it holds the snapshot report only, the same reports useOnyx returns on Search
        expect(result.current).toEqual({[REPORT_ID]: 'Snapshot name'});
    });

    it('should keep the live map and the Search map apart when either source changes', async () => {
        // Given one consumer on a Search screen and one outside it, each with its own map
        await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}1`, createReport('1', {reportName: 'Live name'}));
        await Onyx.merge(SNAPSHOT_KEY, {data: {[REPORT_KEY]: createReport('1', {reportName: 'Snapshot name'})}});
        const {result: searchConsumer} = await renderReportIDToNameMap(SearchScreen);
        const {result: liveConsumer} = await renderReportIDToNameMap();
        const searchMap = searchConsumer.current;
        const liveMap = liveConsumer.current;

        // When the live report and then the snapshot report each get a write that changes no name
        await act(async () => {
            await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}1`, {lastMessageText: 'hello'});
            await waitForBatchedUpdates();
        });
        await act(async () => {
            await Onyx.merge(SNAPSHOT_KEY, {data: {[REPORT_KEY]: {lastMessageText: 'hello'}}});
            await waitForBatchedUpdates();
        });

        // Then both consumers keep the map they had, because each source compares against its own previous reports and not the other's
        expect(liveConsumer.current).toBe(liveMap);
        expect(searchConsumer.current).toBe(searchMap);
        expect(liveMap).toEqual({[REPORT_ID]: 'Live name'});
        expect(searchMap).toEqual({[REPORT_ID]: 'Snapshot name'});
    });
});

describe('getReportIDToNameMapForRoomsInMarkdown', () => {
    const adminsRoomID = '1';
    const announceRoomID = '2';
    const expenseReportID = '3';
    const unnamedReportID = '4';
    const reportIDToName = {[adminsRoomID]: '#admins', [announceRoomID]: '#announce', [expenseReportID]: 'Expense Report', [unnamedReportID]: unnamedReportID};

    it('keeps only the rooms whose name appears in the markdown', () => {
        // Given a draft that mentions one of the rooms
        const markdown = 'hello #admins';

        // When narrowing the map to that draft
        const map = getReportIDToNameMapForRoomsInMarkdown(reportIDToName, markdown);

        // Then only the mentioned room is kept, so a deferred edit does not persist every report name
        expect(map).toEqual({[adminsRoomID]: '#admins'});
    });

    it('skips reports that are not rooms even when their name appears in the markdown', () => {
        // Given a draft that contains the name of an expense report and the reportID used as a fallback name, but no room
        const markdown = 'see Expense Report 4 #';

        // When narrowing the map to that draft
        const map = getReportIDToNameMapForRoomsInMarkdown(reportIDToName, markdown);

        // Then nothing is kept, because only rooms can be mentioned in markdown and their names start with #
        expect(map).toEqual({});
    });

    it('returns undefined when the markdown has no #', () => {
        // Given a draft without any # character, so it cannot mention a room
        const markdown = 'hello admins';

        // When narrowing the map to that draft
        const map = getReportIDToNameMapForRoomsInMarkdown(reportIDToName, markdown);

        // Then no map is returned, so the deferred edit stores nothing
        expect(map).toBeUndefined();
    });

    it('returns undefined when no map is passed', () => {
        // Given a caller that has no reportIDToName map, like tests calling editReportComment without one
        // When narrowing it to a draft that mentions a room
        const map = getReportIDToNameMapForRoomsInMarkdown(undefined, 'hello #admins');

        // Then there is nothing to narrow
        expect(map).toBeUndefined();
    });
});

describe('getMentionedReportIDs', () => {
    it('returns the reportIDs of quoted, unquoted and self-closing room mentions', () => {
        // Given server HTML that uses every form of the ID-based room mention that ExpensiMark accepts
        const html = 'a <mention-report reportID="1"></mention-report> b <mention-report reportID=2></mention-report> c <mention-report reportID="3" />';

        // When reading the mentioned reportIDs
        const reportIDs = getMentionedReportIDs(html);

        // Then all three are found, so none of them is converted to #Hidden for lack of a name
        expect(reportIDs).toEqual(['1', '2', '3']);
    });

    it('returns the reportID when the attribute name is lowercase', () => {
        // Given HTML that went through a DOM serializer, which lowercases attribute names, and that ExpensiMark still accepts
        // cspell:disable-next-line
        const html = 'hello <mention-report reportid="123"></mention-report>';

        // When reading the mentioned reportIDs
        const reportIDs = getMentionedReportIDs(html);

        // Then the room is still found, so ExpensiMark gets its name instead of logging a missing report name
        expect(reportIDs).toEqual(['123']);
    });

    it('returns each reportID once when a room is mentioned several times', () => {
        // Given HTML that mentions the same room twice
        const html = '<mention-report reportID="1"></mention-report> and again <mention-report reportID="1"></mention-report>';

        // When reading the mentioned reportIDs
        const reportIDs = getMentionedReportIDs(html);

        // Then the room is only looked up once
        expect(reportIDs).toEqual(['1']);
    });

    it('ignores room mentions that already hold the room name', () => {
        // Given HTML built by the client, where the mention holds the name instead of a reportID
        const html = 'hello <mention-report>#admins</mention-report>';

        // When reading the mentioned reportIDs
        const reportIDs = getMentionedReportIDs(html);

        // Then nothing needs to be looked up
        expect(reportIDs).toEqual([]);
    });

    it('returns an empty array for missing html', () => {
        // Given no HTML, like a message without a comment fragment
        // When reading the mentioned reportIDs
        const reportIDs = getMentionedReportIDs(undefined);

        // Then nothing needs to be looked up
        expect(reportIDs).toEqual([]);
    });
});

describe('buildReportIDToNameMap', () => {
    const adminsRoomID = '1';
    const announceRoomID = '2';
    const unnamedReportID = '3';
    const reports: OnyxCollection<Report> = {
        [`${ONYXKEYS.COLLECTION.REPORT}${adminsRoomID}`]: createReport(adminsRoomID, {reportName: '#admins'}),
        [`${ONYXKEYS.COLLECTION.REPORT}${announceRoomID}`]: createReport(announceRoomID, {reportName: '#announce'}),
        [`${ONYXKEYS.COLLECTION.REPORT}${unnamedReportID}`]: createReport(unnamedReportID, {reportName: undefined}),
    };

    it('maps every report when no reportIDs are passed', () => {
        // Given a caller that doesn't know which rooms its HTML mentions
        // When building the map
        const map = buildReportIDToNameMap(reports);

        // Then every report is mapped, with the reportID as the fallback name
        expect(map).toEqual({[adminsRoomID]: '#admins', [announceRoomID]: '#announce', [unnamedReportID]: unnamedReportID});
    });

    it('maps only the passed reportIDs', () => {
        // Given HTML that mentions only one of the rooms
        // When building the map for that room
        const map = buildReportIDToNameMap(reports, [announceRoomID]);

        // Then only that room is looked up, so callers don't pay for a pass over every report
        expect(map).toEqual({[announceRoomID]: '#announce'});
    });

    it('skips reportIDs that are not in Onyx', () => {
        // Given a mention of a room the user can't access, so it isn't in Onyx
        // When building the map for it
        const map = buildReportIDToNameMap(reports, [adminsRoomID, '999']);

        // Then the missing room is left out, so ExpensiMark falls back to #Hidden for it
        expect(map).toEqual({[adminsRoomID]: '#admins'});
    });

    it('keys a report cached without its reportID by the reportID it was looked up with', () => {
        // Given a room cached from a partial update that only sent its name, so the report has no reportID
        const partialRoomID = '4';
        const reportsWithPartialRoom: OnyxCollection<Report> = {
            ...reports,
            [`${ONYXKEYS.COLLECTION.REPORT}${partialRoomID}`]: createReport(partialRoomID, {reportID: undefined, reportName: '#partial'}),
        };

        // When building the map for that room, and for every report
        const mentionedMap = buildReportIDToNameMap(reportsWithPartialRoom, [partialRoomID]);
        const fullMap = buildReportIDToNameMap(reportsWithPartialRoom);

        // Then the room is mapped under its reportID instead of undefined, so its mention isn't shown as #Hidden
        expect(mentionedMap).toEqual({[partialRoomID]: '#partial'});
        expect(fullMap[partialRoomID]).toBe('#partial');
    });

    it('returns an empty map when no reportIDs are passed in the list', () => {
        // Given HTML that doesn't mention any room
        // When building the map for an empty list
        const map = buildReportIDToNameMap(reports, []);

        // Then no report is looked up
        expect(map).toEqual({});
    });
});

describe('buildMentionedRoomPlaceholderMap', () => {
    it('maps every room mentioned by reportID to a room placeholder', () => {
        // Given HTML that mentions two rooms by reportID
        const html = '<mention-report reportID="1"></mention-report> and <mention-report reportID="2" />';

        // When building the placeholder map
        const map = buildMentionedRoomPlaceholderMap(html);

        // Then both rooms get a name that starts with #, so emoji checks on the text behave as for a real room name
        expect(Object.keys(map)).toEqual(['1', '2']);
        expect(Object.values(map).every((name) => name.startsWith('#'))).toBe(true);
    });

    it('returns an empty map when the HTML mentions no room by reportID', () => {
        // Given HTML without any reportID mention
        // When building the placeholder map
        const map = buildMentionedRoomPlaceholderMap('hello <mention-report>#admins</mention-report>');

        // Then nothing is mapped
        expect(map).toEqual({});
    });
});
