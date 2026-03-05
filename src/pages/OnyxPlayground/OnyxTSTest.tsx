/* eslint-disable rulesdir/no-onyx-connect */
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

    Onyx.connect({
        // @ts-expect-error raises an error, collection member key - incorrect
        key: `${ONYXKEYS.COLLECTION.REPORT}${`report1`}`,
        callback: (value) => {
            if (!value) {
                return;
            }

            console.log(value.report1?.policyID);
            console.log(value.report2?.policyID);
        },
        waitForCollectionCallback: true,
    });

    Onyx.set(ONYXKEYS.ACCOUNT, {primaryLogin: 'account1'});
    Onyx.set(ONYXKEYS.IS_LOADING_PAYMENT_METHODS, true);
    Onyx.set(ONYXKEYS.NVP_PREFERRED_LOCALE, null);
    Onyx.set(`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`, {isDownloading: true});
    // @ts-expect-error raises an error, passing collection key - correct
    Onyx.set(ONYXKEYS.COLLECTION.DOWNLOAD, {isDownloading: true});
    // @ts-expect-error raises an error, wrong value - correct
    Onyx.set(ONYXKEYS.ACCOUNT, 'wrong value');

    Onyx.multiSet({
        [ONYXKEYS.ACCOUNT]: {primaryLogin: 'id2'},
        [ONYXKEYS.NVP_PREFERRED_LOCALE]: null,
        [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}` as const]: {isDownloading: true},
        [`${ONYXKEYS.COLLECTION.REPORT}${'report1'}` as const]: {reportID: 'download_url'},
        // @ts-expect-error raises an error, wrong value - correct
        [ONYXKEYS.ACTIVE_CLIENTS]: 1,
    });

    Onyx.merge(ONYXKEYS.ACCOUNT, {primaryLogin: 'user name'});
    Onyx.merge(`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`, {});
    Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${'report'}`, {participants: {1: {role: 'admin'}}});
    // @ts-expect-error raises an error, passing collection key - correct
    Onyx.merge(ONYXKEYS.COLLECTION.REPORT, {participants: {1: {role: 'admin'}}});
    // @ts-expect-error raises an error, wrong value - correct
    Onyx.merge(ONYXKEYS.ACCOUNT, 'something');

    Onyx.clear();
    Onyx.clear([ONYXKEYS.ACCOUNT, ONYXKEYS.ACTIVE_CLIENTS, `${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`]);
    // @ts-expect-error raises an error, wrong key - correct
    Onyx.clear(['wrong key']);

    Onyx.mergeCollection(ONYXKEYS.COLLECTION.DOWNLOAD, {
        [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}` as const]: {isDownloading: true},
        [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment3'}` as const]: {isDownloading: true},
        // FIXME: @ts-expect-error raises an error, wrong key - correct
        [`${ONYXKEYS.COLLECTION.REPORT}${'report1'}` as const]: {reportID: 'account'},
        // @ts-expect-error raises an error, wrong value - correct
        [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment2'}` as const]: false,
        // @ts-expect-error raises an error, passing null - correct
        [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment4'}` as const]: null,
    });

    Onyx.mergeCollection(ONYXKEYS.COLLECTION.REPORT, {
        [`${ONYXKEYS.COLLECTION.REPORT}${'report1'}` as const]: {participants: {1: {role: 'admin'}}},
    });

    // @ts-expect-error raises an error, not a collection - correct
    Onyx.mergeCollection(`${ONYXKEYS.COLLECTION.REPORT}${'report'}`, {
        [`${ONYXKEYS.COLLECTION.REPORT}${'report1'}` as const]: {data: {isRead: true}},
    });

    // @ts-expect-error raises an error, not a collection - correct
    Onyx.mergeCollection(ONYXKEYS.ACCOUNT, {
        [`${ONYXKEYS.ACCOUNT}${'report1'}` as const]: {id: 'account'},
    });

    Onyx.setCollection(ONYXKEYS.COLLECTION.DOWNLOAD, {
        [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}` as const]: {isDownloading: true},
        [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment3'}` as const]: {isDownloading: true},
        [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment4'}` as const]: null,
        // FIXME: @ts-expect-error raises an error, wrong key - correct
        [`${ONYXKEYS.COLLECTION.REPORT}${'report1'}` as const]: {reportID: 'account'},
        // @ts-expect-error raises an error, wrong value - correct
        [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment2'}` as const]: false,
    });

    Onyx.setCollection(ONYXKEYS.COLLECTION.REPORT, {
        [`${ONYXKEYS.COLLECTION.REPORT}${'report1'}` as const]: {participants: {1: {role: 'admin'}}},
    });

    // @ts-expect-error raises an error, not a collection - correct
    Onyx.setCollection(`${ONYXKEYS.COLLECTION.REPORT}${'report'}`, {
        [`${ONYXKEYS.COLLECTION.REPORT}${'report1'}` as const]: {data: {isRead: true}},
    });

    // @ts-expect-error raises an error, not a collection - correct
    Onyx.setCollection(ONYXKEYS.ACCOUNT, {
        [`${ONYXKEYS.ACCOUNT}${'report1'}` as const]: {id: 'account'},
    });

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
        // @ts-expect-error raises an error, wrong value - correct
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.IS_LOADING_PAYMENT_METHODS,
            value: {primaryLogin: 'id1'},
        },
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
        // FIXME: @ts-expect-error raises an error, not a collection - correct
        {
            onyxMethod: Onyx.METHOD.MERGE_COLLECTION,
            key: ONYXKEYS.ACCOUNT,
            value: {},
        },
        // FIXME: @ts-expect-error raises an error, not a collection - correct
        {
            onyxMethod: Onyx.METHOD.MERGE_COLLECTION,
            key: `${ONYXKEYS.COLLECTION.REPORT}${'report1'}`,
            value: {},
        },
        {
            onyxMethod: Onyx.METHOD.MERGE_COLLECTION,
            key: ONYXKEYS.COLLECTION.REPORT,
            value: {
                [`${ONYXKEYS.COLLECTION.REPORT}${'report1'}` as const]: {participants: {1: {role: 'admin'}}},
                [`${ONYXKEYS.COLLECTION.REPORT}${'report2'}` as const]: {participants: {1: {role: 'admin'}}},
                // @ts-expect-error raises an error - correct
                [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'report2'}` as const]: {isDownloading: true},
            },
        },

        // @ts-expect-error raises an error, passing undefined to SET - correct
        {
            onyxMethod: Onyx.METHOD.SET,
            key: ONYXKEYS.ACCOUNT,
            value: undefined,
        },

        // @ts-expect-error raises an error, passing undefined to MERGE - correct
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.ACCOUNT,
            value: undefined,
        },

        // @ts-expect-error raises an error, passing undefined to SET - correct
        {
            onyxMethod: Onyx.METHOD.SET,
            key: ONYXKEYS.COLLECTION.DOWNLOAD,
            value: undefined,
        },

        // @ts-expect-error raises an error, passing undefined to MERGE - correct
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.COLLECTION.DOWNLOAD,
            value: undefined,
        },

        // @ts-expect-error raises an error, passing undefined to SET - correct
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`,
            value: undefined,
        },

        // @ts-expect-error raises an error, passing undefined to MERGE - correct
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`,
            value: undefined,
        },

        // Merge collection key with `undefined` at property level.
        // Doesn't produce any results ✅
        // TS DOESN'T complain about it ✅
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`,
            value: {isDownloading: undefined},
        },
    ]);

    const optimisticData: Array<OnyxUpdate<typeof ONYXKEYS.ACCOUNT | typeof ONYXKEYS.COLLECTION.REPORT>> = [
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
                // @ts-expect-error raises an error - correct
                [`${ONYXKEYS.COLLECTION.DOWNLOAD}${'report2'}` as const]: {isDownloading: true},
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
            // @ts-expect-error raises an error, wrong value - correct
            [ONYXKEYS.ACTIVE_CLIENTS]: 'wrong value',
        },
        evictableKeys: [ONYXKEYS.ACCOUNT, `${ONYXKEYS.COLLECTION.DOWNLOAD}${'attachment1'}`],
        maxCachedKeysCount: 1000,
        shouldSyncMultipleInstances: true,
    });

    Onyx.registerLogger(({level, message}) => {});

    // @ts-expect-error raises an error, passing undefined to SET - correct
    Onyx.set(ONYXKEYS.POLICY_ID, undefined);
    // @ts-expect-error raises an error, passing undefined to MERGE - correct
    Onyx.merge(ONYXKEYS.POLICY_ID, undefined);

    // @ts-expect-error raises an error, passing undefined to SET - correct
    Onyx.set(ONYXKEYS.COLLECTION.INEXISTENT, undefined);
    // @ts-expect-error raises an error, passing undefined to MERGE - correct
    Onyx.merge(ONYXKEYS.COLLECTION.INEXISTENT, undefined);

    // @ts-expect-error raises an error, passing undefined to SET - correct
    Onyx.set(`${ONYXKEYS.COLLECTION.INEXISTENT}${'id1'}`, undefined);
    // @ts-expect-error raises an error, passing undefined to MERGE - correct
    Onyx.merge(`${ONYXKEYS.COLLECTION.INEXISTENT}${'id1'}`, undefined);

    // 4. Merge collection key with `undefined` at property level.
    // Doesn't produce any results ✅
    // TS DOESN'T complain about it ✅
    Onyx.merge(`${ONYXKEYS.COLLECTION.INEXISTENT}${'id1'}`, {id: undefined});

    return null;
}
