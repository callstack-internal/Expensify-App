import type * as CoreNavigation from '@react-navigation/core';
import type * as NativeNavigation from '@react-navigation/native';
import {act, render, screen} from '@testing-library/react-native';
import React from 'react';
import Onyx from 'react-native-onyx';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import useReportData from '@components/report/hooks/useReportData';
import {SearchStateContext} from '@components/Search/SearchContext';
import type {SearchStateContextValue} from '@components/Search/types';
import Text from '@components/Text';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

jest.mock('@libs/Navigation/Navigation', () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    getDeepestFocusedScreen: jest.fn(() => undefined),
    navigationRef: {
        getRootState: jest.fn(() => undefined),
    },
}));

// `SearchContextProvider` calls `useNavigation()` and `useRootNavigationState`
// internally to derive the current search query. We mock the navigation surface to
// no-ops so the provider can mount without a `NavigationContainer` wrapper.
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual<typeof NativeNavigation>('@react-navigation/native'),
    useNavigation: () => ({
        navigate: jest.fn(),
        addListener: jest.fn(),
        getState: jest.fn(() => undefined),
    }),
    useNavigationState: () => undefined,
    useIsFocused: () => true,
    useFocusEffect: jest.fn((callback: () => void) => callback()),
    useRoute: () => ({params: {}}),
}));

jest.mock('@react-navigation/core', () => ({
    ...jest.requireActual<typeof CoreNavigation>('@react-navigation/core'),
    useNavigation: jest.fn(() => ({getState: jest.fn(() => undefined)})),
}));

jest.mock('@hooks/useRootNavigationState', () => jest.fn((selector: (state: undefined) => unknown) => selector(undefined)));

const REPORT_ID = '401';

function Probe({reportID}: {reportID: string}) {
    const {report, transactions} = useReportData(reportID);
    return (
        <>
            <Text testID="probe-report-id">{report?.reportID ?? 'null'}</Text>
            <Text testID="probe-tx-count">{String(transactions.length)}</Text>
            <Text testID="probe-tx-ids">{transactions.map((t) => t.transactionID).join(',')}</Text>
        </>
    );
}

// Test wrapper that drives `currentSearchResults` directly into the context the
// hook reads. We bypass `SearchContextProvider` here because its real construction
// path depends on `useNavigation()` / `useRootNavigationState` deriving a search
// query JSON from focused-screen params — that machinery is irrelevant to the hook
// under test, so injecting the context value is the narrower seam.
function renderProbe(reportID: string = REPORT_ID, snapshotData?: Record<string, unknown>) {
    const stateValue = {
        currentSearchResults: snapshotData ? ({data: snapshotData, search: {hasResults: true}} as unknown) : undefined,
    } as unknown as SearchStateContextValue;
    return render(
        <OnyxListItemProvider>
            <SearchStateContext.Provider value={stateValue}>
                <Probe reportID={reportID} />
            </SearchStateContext.Provider>
        </OnyxListItemProvider>,
    );
}

async function setReport(report: Record<string, unknown>) {
    await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {reportID: REPORT_ID, ...report});
}

async function setReportTransactions(transactions: Array<{transactionID: string; reportID?: string}>) {
    // The hook reads transactions via `useReportTransactionsCollection`, which selects
    // from the derived `REPORT_TRANSACTIONS_AND_VIOLATIONS` value. Drive that derived
    // value directly so the hook's Onyx-first branch is exercised end-to-end.
    const transactionsByID: Record<string, Record<string, unknown>> = {};
    for (const t of transactions) {
        transactionsByID[t.transactionID] = {transactionID: t.transactionID, reportID: t.reportID ?? REPORT_ID};
    }
    await Onyx.merge(ONYXKEYS.DERIVED.REPORT_TRANSACTIONS_AND_VIOLATIONS, {
        [REPORT_ID]: {
            transactions: transactionsByID,
        },
    });
}

describe('useReportData', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        await Onyx.clear();
    });

    it('returns Onyx data when populated; snapshot is not consulted', async () => {
        await setReport({type: CONST.REPORT.TYPE.EXPENSE});
        await setReportTransactions([{transactionID: 'tx-onyx-1'}, {transactionID: 'tx-onyx-2'}]);

        // Provide a snapshot too — the hook should ignore it because Onyx has the report.
        renderProbe(REPORT_ID, {
            [`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`]: {reportID: REPORT_ID, type: 'snapshot-poison'},
            [`${ONYXKEYS.COLLECTION.TRANSACTION}tx-snapshot`]: {transactionID: 'tx-snapshot', reportID: REPORT_ID},
        });
        await waitForBatchedUpdatesWithAct();

        expect(screen.getByTestId('probe-report-id').props.children).toBe(REPORT_ID);
        expect(screen.getByTestId('probe-tx-count').props.children).toBe('2');
        const ids = (screen.getByTestId('probe-tx-ids').props.children as string).split(',').sort();
        expect(ids).toEqual(['tx-onyx-1', 'tx-onyx-2']);
    });

    it('returns snapshot data when Onyx is empty AND snapshot has data', async () => {
        renderProbe(REPORT_ID, {
            [`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`]: {reportID: REPORT_ID, type: CONST.REPORT.TYPE.EXPENSE},
            [`${ONYXKEYS.COLLECTION.TRANSACTION}tx-snapshot-1`]: {transactionID: 'tx-snapshot-1', reportID: REPORT_ID},
            [`${ONYXKEYS.COLLECTION.TRANSACTION}tx-snapshot-2`]: {transactionID: 'tx-snapshot-2', reportID: REPORT_ID},
            // Foreign transaction — different report; must NOT appear.
            [`${ONYXKEYS.COLLECTION.TRANSACTION}tx-foreign`]: {transactionID: 'tx-foreign', reportID: 'foreign-report'},
            // Violations key starts with the same prefix as TRANSACTION; must be skipped.
            [`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}tx-snapshot-1`]: [],
        });
        await waitForBatchedUpdatesWithAct();

        expect(screen.getByTestId('probe-report-id').props.children).toBe(REPORT_ID);
        expect(screen.getByTestId('probe-tx-count').props.children).toBe('2');
        const ids = (screen.getByTestId('probe-tx-ids').props.children as string).split(',').sort();
        expect(ids).toEqual(['tx-snapshot-1', 'tx-snapshot-2']);
    });

    it('returns nulls when both Onyx and snapshot are empty', async () => {
        renderProbe();
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByTestId('probe-report-id').props.children).toBe('null');
        expect(screen.getByTestId('probe-tx-count').props.children).toBe('0');
    });

    it('returns Onyx data once Onyx populates after the snapshot was used', async () => {
        renderProbe(REPORT_ID, {
            [`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`]: {reportID: REPORT_ID, type: CONST.REPORT.TYPE.EXPENSE},
            [`${ONYXKEYS.COLLECTION.TRANSACTION}tx-snapshot-1`]: {transactionID: 'tx-snapshot-1', reportID: REPORT_ID},
        });
        await waitForBatchedUpdatesWithAct();

        // Snapshot serves the data first.
        expect(screen.getByTestId('probe-tx-ids').props.children).toBe('tx-snapshot-1');

        // Onyx populates with different data; the hook must flip to it on next render.
        await act(async () => {
            await setReport({type: CONST.REPORT.TYPE.EXPENSE});
            await setReportTransactions([{transactionID: 'tx-onyx-1'}]);
        });
        await waitForBatchedUpdatesWithAct();

        expect(screen.getByTestId('probe-tx-ids').props.children).toBe('tx-onyx-1');
    });
});
