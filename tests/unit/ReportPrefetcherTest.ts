import prefetchReport from '@libs/Search/ReportPrefetcher';
import * as ReportActions from '@userActions/Report';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';

jest.mock('@userActions/Report', () => ({
    openReport: jest.fn(),
}));

const mockOpenReport = jest.mocked(ReportActions.openReport);

// Each test uses a unique reportID because the prefetcher dedupes per-session at module level.
const REPORT_FRESH = '500001';
const REPORT_DEDUPED = '500004';

beforeEach(() => {
    mockOpenReport.mockClear();
});

describe('prefetchReport', () => {
    it('calls openReport for a report we have never prefetched before', async () => {
        prefetchReport({reportID: REPORT_FRESH, introSelected: undefined, betas: undefined});
        await waitForBatchedUpdates();

        expect(mockOpenReport).toHaveBeenCalledTimes(1);
        expect(mockOpenReport).toHaveBeenCalledWith({reportID: REPORT_FRESH, introSelected: undefined, betas: undefined});
    });

    it('does not refire openReport if the same report is requested twice in the same session', async () => {
        prefetchReport({reportID: REPORT_DEDUPED, introSelected: undefined, betas: undefined});
        await waitForBatchedUpdates();
        prefetchReport({reportID: REPORT_DEDUPED, introSelected: undefined, betas: undefined});
        await waitForBatchedUpdates();

        expect(mockOpenReport).toHaveBeenCalledTimes(1);
    });
});
