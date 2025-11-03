/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/naming-convention */

/* eslint-disable react/no-unused-prop-types */

/* eslint-disable no-console */

/* eslint-disable rulesdir/prefer-actions-set-data */

/* eslint-disable rulesdir/prefer-onyx-connect-in-libs */
import type {OnyxCollection, OnyxEntry, OnyxUpdate} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Account, Report} from '@src/types/onyx';

type OnyxTSTestOnyxProps = {
    onyxPropWithStringKey: OnyxEntry<Account>;
    onyxPropWithStringKeyAndFunctionSelector: string;

    onyxPropWithFunctionKey: OnyxEntry<Account>;
    onyxPropWithFunctionKeyAndFunctionSelector: string;

    onyxPropWithStringCollectionKey: OnyxCollection<Report>;
    onyxPropWithStringCollectionKeyAndFunctionSelector: OnyxCollection<string>;

    onyxPropWithStringCollectionRecordKey: OnyxEntry<Report>;
    onyxPropWithStringCollectionRecordKeyAndFunctionSelector: boolean;

    onyxPropWithFunctionCollectionKey: OnyxCollection<Report>;
    onyxPropWithFunctionCollectionKeyAndFunctionSelector: OnyxCollection<boolean>;

    onyxPropWithFunctionCollectionRecordKey: OnyxEntry<Report>;
    onyxPropWithFunctionCollectionRecordKeyAndFunctionSelector: boolean;
};

type OnyxTSTestProps = OnyxTSTestOnyxProps & {
    reportId: string;
    prop2?: number;
};

function OnyxTSTest({reportId, prop2 = 0}: OnyxTSTestProps) {
    // const keys = Onyx.getAllKeys();

    // const isSafeEvictionKey = Onyx.isSafeEvictionKey(ONYXKEYS.ACCOUNT);
    // const isSafeEvictionCollectionKey = Onyx.isSafeEvictionKey(`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`);
    // const isSafeEvictionWrongKey = Onyx.isSafeEvictionKey('wrong key'); // raises an error, wrong key - correct

    // Onyx.removeFromEvictionBlockList(ONYXKEYS.ACTIVE_CLIENTS, 1);
    // Onyx.removeFromEvictionBlockList(`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`, 1);
    // Onyx.removeFromEvictionBlockList('wrong key', 1); // raises an error, wrong key - correct

    // Onyx.addToEvictionBlockList(ONYXKEYS.ACTIVE_CLIENTS, 2);
    // Onyx.addToEvictionBlockList(`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`, 2);
    // Onyx.addToEvictionBlockList('wrong key', 1); // raises an error, wrong key - correct

    Onyx.connect({
        key: ONYXKEYS.ACCOUNT,
        callback: (value) => {
            if (!value) {
                return;
            }

            console.log(value.primaryLogin);
        },
    });

    Onyx.connect({
        key: `${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`,
        callback: (value) => {
            if (!value) {
                return;
            }

            console.log(value.isDownloading);
        },
    });

    Onyx.connect({
        key: ONYXKEYS.COLLECTION.REPORT,
        callback: (value) => {
            if (!value) {
                return;
            }

            console.log(value.report1?.policyID);
            console.log(value.report2?.policyID);
        },
        waitForCollectionCallback: true,
    });

    Onyx.connect({
        key: ONYXKEYS.COLLECTION.REPORT,
        callback: (value, key) => {
            if (!value) {
                return;
            }

            console.log(value.policyID);
            console.log(value.policyID);
        },
        waitForCollectionCallback: false,
    });

    // raises an error, collection member key - incorrect
    // Onyx.connect({
    //     key: `${ONYXKEYS.COLLECTION.REPORT}${`report1`}`,
    //     callback: (value) => {
    //         if (!value) {
    //             return;
    //         }

    //         console.log(value.report1?.policyID);
    //         console.log(value.report2?.policyID);
    //     },
    //     waitForCollectionCallback: true,
    // });

    Onyx.set(ONYXKEYS.ACCOUNT, {primaryLogin: 'account1'});
    Onyx.set(ONYXKEYS.IS_LOADING_PAYMENT_METHODS, true);
    Onyx.set(ONYXKEYS.NVP_PREFERRED_LOCALE, null);
    Onyx.set(`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`, {isDownloading: true});
    // Onyx.set(ONYXKEYS.ACCOUNT, 'wrong value'); // raises an error, wrong value - correct

    Onyx.multiSet({
        [ONYXKEYS.ACCOUNT]: {primaryLogin: 'id2'},
        [ONYXKEYS.NVP_PREFERRED_LOCALE]: null,
        [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}` as const]: {isDownloading: true},
        [`${ONYXKEYS.COLLECTION.REPORT}${'report1'}` as const]: {reportID: 'download_url'},
        // [ONYXKEYS.ACTIVE_CLIENTS]: 1, // raises an error, wrong value - correct
    });

    Onyx.merge(ONYXKEYS.ACCOUNT, {primaryLogin: 'user name'});
    Onyx.merge(`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`, {});
    Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${'report'}`, {participants: {1: {role: 'admin'}}});
    // Onyx.merge(ONYXKEYS.ACCOUNT, 'something'); // raises an error, wrong value - correct

    Onyx.clear();
    Onyx.clear([ONYXKEYS.ACCOUNT, ONYXKEYS.ACTIVE_CLIENTS, `${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`]);
    // Onyx.clear(['wrong key']); // raises an error, wrong key - correct

    Onyx.mergeCollection(ONYXKEYS.COLLECTION.DOWNLOAD, {
        [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}` as const]: {isDownloading: true},
        [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment3'}` as const]: {isDownloading: true},
        // [`${ONYXKEYS.COLLECTION.REPORT}${'report1'}` as const]: {reportID: 'account'}, // raises an error, wrong key - correct
        // [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment2'}` as const]: false, // raises an error, wrong value - correct
        // [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment4'}` as const]: null, // raises an error, passing null - correct
    });

    Onyx.mergeCollection(ONYXKEYS.COLLECTION.REPORT, {
        [`${ONYXKEYS.COLLECTION.REPORT}${'report1'}` as const]: {participants: {1: {role: 'admin'}}},
    });

    // Onyx.mergeCollection(`${ONYXKEYS.COLLECTION.REPORT}${'report'}`, {
    //     [`${ONYXKEYS.COLLECTION.REPORT}${'report1'}` as const]: {data: {isRead: true}},
    // }); // raises an error, not a collection - correct

    // Onyx.mergeCollection(ONYXKEYS.ACCOUNT, {
    //     [`${ONYXKEYS.ACCOUNT}${'report1'}` as const]: {id: 'account'},
    // }); // raises an error, not a collection - correct

    Onyx.setCollection(ONYXKEYS.COLLECTION.DOWNLOAD, {
        [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}` as const]: {isDownloading: true},
        [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment3'}` as const]: {isDownloading: true},
        [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment4'}` as const]: null,
        // [`${ONYXKEYS.COLLECTION.REPORT}${'report1'}` as const]: {reportID: 'account'}, // raises an error, wrong key - correct
        // [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment2'}` as const]: false, // raises an error, wrong value - correct
    });

    Onyx.setCollection(ONYXKEYS.COLLECTION.REPORT, {
        [`${ONYXKEYS.COLLECTION.REPORT}${'report1'}` as const]: {participants: {1: {role: 'admin'}}},
    });

    // Onyx.setCollection(`${ONYXKEYS.COLLECTION.REPORT}${'report'}`, {
    //     [`${ONYXKEYS.COLLECTION.REPORT}${'report1'}` as const]: {data: {isRead: true}},
    // }); // raises an error, not a collection - correct

    // Onyx.setCollection(ONYXKEYS.ACCOUNT, {
    //     [`${ONYXKEYS.ACCOUNT}${'report1'}` as const]: {id: 'account'},
    // }); // raises an error, not a collection - correct

    Onyx.update([
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.ACCOUNT,
            value: {primaryLogin: 'id1'},
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.IS_LOADING_PAYMENT_METHODS,
            value: false,
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: ONYXKEYS.IS_LOADING_PAYMENT_METHODS,
            value: null,
        },
        // {
        //     onyxMethod: Onyx.METHOD.MERGE,
        //     key: ONYXKEYS.IS_LOADING_PAYMENT_METHODS,
        //     value: {primaryLogin: 'id1'}, // raises an error, wrong value - correct
        // },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`,
            value: {isDownloading: true},
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT}${'report1'}`,
            value: {reportID: 'id1', participants: {1: {role: 'admin', notificationPreference: 'always'}}},
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${'report2'}`,
            value: {participants: {1: {role: 'admin'}}},
        },
        // {
        //     onyxMethod: Onyx.METHOD.MERGE_COLLECTION,
        //     key: ONYXKEYS.ACCOUNT,
        //     value: {},
        // }, // raises an error, not a collection - correct
        // {
        //     onyxMethod: Onyx.METHOD.MERGE_COLLECTION,
        //     key: `${ONYXKEYS.COLLECTION.REPORT}${'report1'}`,
        //     value: {},
        // }, // raises an error, not a collection - correct
        {
            onyxMethod: Onyx.METHOD.MERGE_COLLECTION,
            key: ONYXKEYS.COLLECTION.REPORT,
            value: {
                [`${ONYXKEYS.COLLECTION.REPORT}${'report1'}` as const]: {participants: {1: {role: 'admin'}}},
                [`${ONYXKEYS.COLLECTION.REPORT}${'report2'}` as const]: {participants: {1: {role: 'admin'}}},
                // [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'report2'}` as const]: {isDownloading: true}, // raises an error - correct
            },
        },

        // 1. Set / Merge key with `undefined` at root level.
        // Doesn't produce any results ✅
        // TS complains about it ✅
        // {
        //     // onyxMethod: Onyx.METHOD.SET,
        //     onyxMethod: Onyx.METHOD.MERGE,
        //     key: ONYXKEYS.ACCOUNT,
        //     value: undefined,
        // },

        // 2. Set / Merge collection key with `undefined` at root level.
        // Doesn't produce any results ✅
        // TS complains about it ✅
        // {
        //     // onyxMethod: Onyx.METHOD.SET,
        //     onyxMethod: Onyx.METHOD.MERGE,
        //     key: ONYXKEYS.COLLECTION.DOWNLOAD,
        //     value: undefined,
        // },

        // 3. Set / Merge collection key with `undefined` at record level.
        // Doesn't produce any results ✅
        // TS complains about it ✅
        // {
        //     // onyxMethod: Onyx.METHOD.SET,
        //     onyxMethod: Onyx.METHOD.MERGE,
        //     key: `${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`,
        //     value: undefined,
        // },

        // 4. Merge collection key with `undefined` at property level.
        // Doesn't produce any results ✅
        // TS DOESN'T complain about it ✅
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`,
            value: {isDownloading: undefined},
        },
    ]);

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.ACCOUNT,
            value: {primaryLogin: 'id1'},
        },
        {
            onyxMethod: Onyx.METHOD.MERGE_COLLECTION,
            key: ONYXKEYS.COLLECTION.REPORT,
            value: {
                [`${ONYXKEYS.COLLECTION.REPORT}${'report1'}` as const]: {participants: {1: {role: 'admin'}}},
                [`${ONYXKEYS.COLLECTION.REPORT}${'report2'}` as const]: {participants: {1: {role: 'admin'}}},
                // [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'report2'}` as const]: {isDownloading: true}, // raises an error - correct
            },
        },
    ];
    Onyx.update(optimisticData);

    Onyx.init({
        keys: ONYXKEYS,
        initialKeyStates: {
            [ONYXKEYS.ACCOUNT]: {primaryLogin: 'id1'},
            [ONYXKEYS.IS_LOADING_PAYMENT_METHODS]: false,
            [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}` as const]: {isDownloading: true},
            // [ONYXKEYS.ACTIVE_CLIENTS]: 'wrong value', // raises an error, wrong value - correct
        },
        evictableKeys: [ONYXKEYS.ACCOUNT, `${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`],
        maxCachedKeysCount: 1000,
        shouldSyncMultipleInstances: true,
    });

    Onyx.registerLogger(({level, message}) => {});

    // Onyx.hasPendingMergeForKey(ONYXKEYS.ACCOUNT);
    // Onyx.hasPendingMergeForKey('wrong key'); // raises an error, wrong key - correct

    // Onyx.setMemoryOnlyKeys([ONYXKEYS.ACCOUNT, ONYXKEYS.COLLECTION.DOWNLOAD, `${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`]);

    // 1. Set / Merge key with `undefined` at root level.
    // Doesn't produce any results ✅
    // TS complains about it ✅
    // Onyx.set(ONYXKEYS.POLICY_ID, undefined);
    // Onyx.merge(ONYXKEYS.POLICY_ID, undefined);

    // 2. Set / Merge collection key with `undefined` at root level.
    // Doesn't produce any results ✅
    // TS complains about it ✅
    // Onyx.set(ONYXKEYS.COLLECTION.INEXISTENT, undefined);
    // Onyx.merge(ONYXKEYS.COLLECTION.INEXISTENT, undefined);

    // 3. Set / Merge collection key with `undefined` at record level.
    // Doesn't produce any results ✅
    // TS complains about it ✅
    // Onyx.set(`${ONYXKEYS.COLLECTION.INEXISTENT}${'id1'}`, undefined);
    // Onyx.merge(`${ONYXKEYS.COLLECTION.INEXISTENT}${'id1'}`, undefined);

    // 4. Merge collection key with `undefined` at property level.
    // Doesn't produce any results ✅
    // TS DOESN'T complain about it ✅
    Onyx.merge(`${ONYXKEYS.COLLECTION.INEXISTENT}${'id1'}`, {id: undefined});

    return null;
}
