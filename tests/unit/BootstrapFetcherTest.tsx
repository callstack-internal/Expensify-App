import {render} from '@testing-library/react-native';
import React from 'react';
import Onyx from 'react-native-onyx';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import BootstrapFetcher from '@components/report/shared/BootstrapFetcher';
import {openReport} from '@libs/actions/Report';
import ONYXKEYS from '@src/ONYXKEYS';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

jest.mock('@libs/actions/Report', () => {
    const actual = jest.requireActual<Record<string, unknown>>('@libs/actions/Report');
    return {
        ...actual,
        openReport: jest.fn(),
    };
});

const REPORT_ID = '42';

function renderFetcher(reportID: string | undefined = REPORT_ID) {
    return render(
        <OnyxListItemProvider>
            <BootstrapFetcher reportID={reportID} />
        </OnyxListItemProvider>,
    );
}

describe('BootstrapFetcher', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        await Onyx.clear();
    });

    it('fires openReport once when the report record is missing in Onyx', async () => {
        renderFetcher();
        await waitForBatchedUpdatesWithAct();
        expect(openReport).toHaveBeenCalledTimes(1);
        expect(openReport).toHaveBeenCalledWith(expect.objectContaining({reportID: REPORT_ID}));
    });

    it('is idempotent: does NOT fire openReport when the report record is already populated in Onyx', async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${REPORT_ID}`, {reportID: REPORT_ID});
        renderFetcher();
        await waitForBatchedUpdatesWithAct();
        expect(openReport).not.toHaveBeenCalled();
    });

    it('does not re-fire openReport on rerender of the same reportID', async () => {
        const {rerender} = renderFetcher();
        await waitForBatchedUpdatesWithAct();
        expect(openReport).toHaveBeenCalledTimes(1);

        rerender(
            <OnyxListItemProvider>
                <BootstrapFetcher reportID={REPORT_ID} />
            </OnyxListItemProvider>,
        );
        await waitForBatchedUpdatesWithAct();
        expect(openReport).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when reportID is empty', async () => {
        renderFetcher('');
        await waitForBatchedUpdatesWithAct();
        expect(openReport).not.toHaveBeenCalled();
    });
});
