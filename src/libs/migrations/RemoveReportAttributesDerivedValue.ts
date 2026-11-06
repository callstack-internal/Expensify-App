/* eslint-disable @typescript-eslint/no-deprecated -- removing the old REPORT_ATTRIBUTES value is this file's entire purpose */
import Log from '@libs/Log';
import readOnceOnyxValue from '@libs/readOnceOnyxValue';

import ONYXKEYS from '@src/ONYXKEYS';

import Onyx from 'react-native-onyx';

/**
 * REPORT_ATTRIBUTES used to be a derived value written to disk on every recompute, a few MB on large accounts.
 * Nothing reads it anymore, so the stored copy is deleted instead of staying on the device for good.
 */
export default async function RemoveReportAttributesDerivedValue(): Promise<void> {
    if ((await readOnceOnyxValue(ONYXKEYS.LEGACY_REPORT_ATTRIBUTES)) === undefined) {
        return;
    }
    await Onyx.multiSet({[ONYXKEYS.LEGACY_REPORT_ATTRIBUTES]: null});
    Log.info('[Migrate Onyx] Ran RemoveReportAttributesDerivedValue migration');
}
