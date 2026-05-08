import {render, screen} from '@testing-library/react-native';
import React from 'react';
import Onyx from 'react-native-onyx';
import {LocaleContextProvider} from '@components/LocaleContextProvider';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import TaskReportHeader from '@components/report/TaskReport/Header';
import TaskReportInitHandler from '@components/report/TaskReport/InitHandler';
import {readNewestAction} from '@libs/actions/Report';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

jest.mock('@libs/Navigation/Navigation', () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
}));

jest.mock('@libs/actions/Report', () => {
    const actual = jest.requireActual<Record<string, unknown>>('@libs/actions/Report');
    return {
        ...actual,
        readNewestAction: jest.fn(),
        openReport: jest.fn(),
    };
});

// HeaderView is the real-header sub-component the task Header block mounts when the
// report record exists. Mock to a simple Text so the test asserts the
// "block routed to real header" decision without dragging in the heavy header tree.
// The mock surfaces the report id so the test can confirm forwarding.
jest.mock('@pages/inbox/HeaderView', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const ReactLocal = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    function HeaderViewMock(props: {reportID?: string}) {
        return ReactLocal.createElement(RN.View, {testID: 'task-header-view'}, ReactLocal.createElement(RN.Text, {testID: 'task-header-view-report-id'}, props.reportID ?? 'no-report-id'));
    }
    HeaderViewMock.displayName = 'HeaderViewMock';
    return {
        __esModule: true,
        default: HeaderViewMock,
    };
});

const REPORT_ID = '7';

describe('TaskReport.Header', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        await Onyx.clear();
    });

    function renderHeader(reportID: string | undefined = REPORT_ID) {
        const onBack = jest.fn();
        return render(
            <OnyxListItemProvider>
                <LocaleContextProvider>
                    <TaskReportHeader
                        reportID={reportID}
                        onBackButtonPress={onBack}
                    />
                </LocaleContextProvider>
            </OnyxListItemProvider>,
        );
    }

    it('renders the HeaderSkeleton when the report record is null', async () => {
        renderHeader();
        await waitForBatchedUpdatesWithAct();
        expect(screen.queryByTestId('task-header-view')).toBeNull();
    });

    it('renders HeaderView when the task report exists', async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {
            reportID: REPORT_ID,
            type: CONST.REPORT.TYPE.TASK,
        });
        renderHeader();
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByTestId('task-header-view')).toBeTruthy();
    });

    it('forwards reportID to HeaderView', async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {
            reportID: REPORT_ID,
            type: CONST.REPORT.TYPE.TASK,
        });
        renderHeader();
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByTestId('task-header-view-report-id').props.children).toBe(REPORT_ID);
    });
});

describe('TaskReport.InitHandler', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        await Onyx.clear();
    });

    function renderInitHandler(reportID: string | undefined = REPORT_ID) {
        return render(
            <OnyxListItemProvider>
                <TaskReportInitHandler reportID={reportID} />
            </OnyxListItemProvider>,
        );
    }

    it('does not fire readNewestAction when report-actions are empty / not yet loaded', async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {reportID: REPORT_ID});
        renderInitHandler();
        await waitForBatchedUpdatesWithAct();
        expect(readNewestAction).not.toHaveBeenCalled();
    });

    it('does not fire readNewestAction when lastReadTime is already set', async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {
            reportID: REPORT_ID,
            lastReadTime: '2025-01-01 00:00:00.000',
        });
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`, {
            reportAction1: {reportActionID: '1', actionName: CONST.REPORT.ACTIONS.TYPE.CREATED},
        });
        renderInitHandler();
        await waitForBatchedUpdatesWithAct();
        expect(readNewestAction).not.toHaveBeenCalled();
    });

    it('fires readNewestAction once after report-actions are populated and lastReadTime is empty', async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {reportID: REPORT_ID});
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`, {
            reportAction1: {reportActionID: '1', actionName: CONST.REPORT.ACTIONS.TYPE.CREATED},
        });
        renderInitHandler();
        await waitForBatchedUpdatesWithAct();
        expect(readNewestAction).toHaveBeenCalledTimes(1);
        expect((readNewestAction as jest.Mock).mock.calls.at(0)).toEqual([REPORT_ID, true]);
    });

    it('does not re-fire readNewestAction on rerender for the same reportID', async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {reportID: REPORT_ID});
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${REPORT_ID}`, {
            reportAction1: {reportActionID: '1', actionName: CONST.REPORT.ACTIONS.TYPE.CREATED},
        });
        const {rerender} = renderInitHandler();
        await waitForBatchedUpdatesWithAct();
        expect(readNewestAction).toHaveBeenCalledTimes(1);

        rerender(
            <OnyxListItemProvider>
                <TaskReportInitHandler reportID={REPORT_ID} />
            </OnyxListItemProvider>,
        );
        await waitForBatchedUpdatesWithAct();
        expect(readNewestAction).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when reportID is empty', async () => {
        renderInitHandler('');
        await waitForBatchedUpdatesWithAct();
        expect(readNewestAction).not.toHaveBeenCalled();
    });
});
