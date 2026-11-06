/* eslint-disable @typescript-eslint/no-deprecated -- exercising the migration means writing the old REPORT_ATTRIBUTES value */
import RemoveReportAttributesDerivedValue from '@libs/migrations/RemoveReportAttributesDerivedValue';

import ONYXKEYS from '@src/ONYXKEYS';

import Onyx from 'react-native-onyx';

import getOnyxValue from '../utils/getOnyxValue';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';

describe('RemoveReportAttributesDerivedValue', () => {
    beforeAll(() => Onyx.init({keys: ONYXKEYS}));
    beforeEach(() => Onyx.clear().then(waitForBatchedUpdates));

    it('should delete the stored report attributes', async () => {
        // Given a device that still holds the value the derived key used to write
        await Onyx.set(ONYXKEYS.LEGACY_REPORT_ATTRIBUTES, {reports: {}, locale: 'en'});

        // When the migration runs at startup
        await RemoveReportAttributesDerivedValue();
        await waitForBatchedUpdates();

        // Then nothing of it is left on the device
        expect(await getOnyxValue(ONYXKEYS.LEGACY_REPORT_ATTRIBUTES)).toBeUndefined();
    });

    it('should write nothing when there is nothing to delete', async () => {
        // Given a device that never stored the old value
        const multiSetSpy = jest.spyOn(Onyx, 'multiSet');

        // When the migration runs
        await RemoveReportAttributesDerivedValue();

        // Then it does not write, so startup does no needless storage work
        expect(multiSetSpy).not.toHaveBeenCalled();
        multiSetSpy.mockRestore();
    });
});
