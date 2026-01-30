/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable no-console */
/* eslint-disable rulesdir/prefer-actions-set-data */
import {deepEqual} from 'fast-equals';
import React, {useState} from 'react';
import {View} from 'react-native';
import type {OnyxKey} from 'react-native-onyx';
// eslint-disable-next-line no-restricted-imports
import Onyx, {useOnyx} from 'react-native-onyx';
import type {StorageKeyList} from 'react-native-onyx/dist/storage/providers/types';
import * as Expensicons from '@components/Icon/Expensicons';
import MenuItem from '@components/MenuItem';
import Switch from '@components/Switch';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportAction} from '@src/types/onyx';
import {createDBPairs, createRandomReportAction, sleep} from './utils';

const COLLECTION_SIZE = 1000;
const SINGLE_OPERATION_RUNS = 100;
const SINGLE_OPERATION_SLEEP_TIME_MS = 20;
const MULTI_OPERATION_RUNS = 100;
const MULTI_OPERATION_SLEEP_TIME_MS = 200;

const createKeys = (key = ONYXKEYS.COLLECTION.DB_COLLECTION_TEST_DATA, length = COLLECTION_SIZE) => Array.from(Array(length).keys()).map((index) => `${key}${index + 1}`);
const createNullPairs = () =>
    createDBPairs(
        (item, index) => `${ONYXKEYS.COLLECTION.DB_COLLECTION_TEST_DATA}${index}`,
        () => null,
        COLLECTION_SIZE,
    );
const createStringPairs = () =>
    createDBPairs(
        (item, index) => `${ONYXKEYS.COLLECTION.DB_COLLECTION_TEST_DATA}${index}`,
        (index) => `string_${index}`,
        COLLECTION_SIZE,
    );
const createNumberPairs = () =>
    createDBPairs(
        (item, index) => `${ONYXKEYS.COLLECTION.DB_COLLECTION_TEST_DATA}${index}`,
        (index) => index,
        COLLECTION_SIZE,
    );
const createEmptyObjectPairs = () =>
    createDBPairs(
        (item, index) => `${ONYXKEYS.COLLECTION.DB_COLLECTION_TEST_DATA}${index}`,
        () => {},
        COLLECTION_SIZE,
    );
const createReportActionObjectPairs = (shouldCreateNullEntries?: boolean) =>
    createDBPairs<ReportAction | null>(
        (item, index) => `${ONYXKEYS.COLLECTION.DB_COLLECTION_TEST_DATA}${item?.reportActionID ?? index}`,
        // eslint-disable-next-line no-nested-ternary
        (index) => (shouldCreateNullEntries ? (index % 2 === 0 ? null : createRandomReportAction(index)) : createRandomReportAction(index)),
        COLLECTION_SIZE,
    );

function DBWriteTest() {
    const styles = useThemeStyles();
    const [shouldWriteMultiple, setShouldWriteMultiple] = useState(false);
    const [dbTestData] = useOnyx(ONYXKEYS.DB_TEST_DATA);

    console.log('OnyxPlayground [App] DBWriteTest dbTestData', dbTestData);

    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    const performWriteOperation = async (operation: () => any | Promise<any>, writes: number, sleepTime: number) => {
        if (shouldWriteMultiple) {
            for (let i = 0; i < writes; i++) {
                operation();
                // eslint-disable-next-line no-await-in-loop
                await sleep(sleepTime);
            }

            // Alert.alert('Write 1000x finished!');
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unused-vars
            const result = await operation();
            console.log('OnyxPlayground [App] DBWriteTest performWriteOperation', result);
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    const validateWrite = async (keys: OnyxKey[], data: any, operation: (keys: OnyxKey[], data: any) => any | Promise<any>) => {
        await operation(keys, data);

        const storedData = (await Onyx.storage.multiGet(keys)).reduce(
            (obj, pair) => {
                obj[pair[0]] = pair[1];
                return obj;
            },
            {} as Record<string, any>,
        );
        const oldData =
            keys.length === 1
                ? // eslint-disable-next-line rulesdir/prefer-at
                  {[keys[0]]: data}
                : keys.reduce(
                      (obj, k, index) => {
                          obj[k] = data[index];
                          return obj;
                      },
                      {} as Record<string, any>,
                  );

        console.log('OnyxPlayground [App] DBWriteTest validateWrite', deepEqual(oldData, storedData) ? 'PASS' : 'FAIL', oldData, storedData);
    };

    return (
        <>
            <Text style={[styles.textHeadline, styles.mb2, styles.ph5]}>DBWriteTest</Text>
            <View style={[styles.flex1, styles.flexRow, styles.p4, styles.justifyContentBetween]}>
                <View style={styles.flex4}>
                    <Text>Write multiple</Text>
                </View>
                <View style={[styles.flex1, styles.alignItemsEnd]}>
                    <Switch
                        accessibilityLabel="Write multiple"
                        isOn={shouldWriteMultiple}
                        onToggle={setShouldWriteMultiple}
                    />
                </View>
            </View>

            <Text style={[styles.h1, styles.mb2, styles.ph5]}>getItem</Text>
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Get item"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.getItem(ONYXKEYS.DB_TEST_DATA), SINGLE_OPERATION_RUNS, SINGLE_OPERATION_SLEEP_TIME_MS);
                }}
            />

            <Text style={[styles.h1, styles.mb2, styles.ph5]}>multiGet</Text>
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Get item"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiGet(createKeys() as StorageKeyList), MULTI_OPERATION_RUNS, MULTI_OPERATION_SLEEP_TIME_MS);
                }}
            />

            <Text style={[styles.h1, styles.mb2, styles.ph5]}>setItem</Text>
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set null"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.setItem(ONYXKEYS.DB_TEST_DATA, null), SINGLE_OPERATION_RUNS, SINGLE_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set string primitive"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.setItem(ONYXKEYS.DB_TEST_DATA, 'something'), SINGLE_OPERATION_RUNS, SINGLE_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set number primitive"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.setItem(ONYXKEYS.DB_TEST_DATA, 0), SINGLE_OPERATION_RUNS, SINGLE_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set empty object"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.setItem(ONYXKEYS.DB_TEST_DATA, {}), SINGLE_OPERATION_RUNS, SINGLE_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set sample report object"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.setItem(ONYXKEYS.DB_TEST_DATA, createRandomReportAction(1)), SINGLE_OPERATION_RUNS, SINGLE_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Validate write"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    validateWrite([ONYXKEYS.DB_TEST_DATA], createRandomReportAction(1), ([key], data) => Onyx.storage.setItem(key, data));
                }}
            />

            <Text style={[styles.h1, styles.mb2, styles.ph5]}>multiSet</Text>
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set null"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiSet(createNullPairs()), MULTI_OPERATION_RUNS, MULTI_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set string primitive"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiSet(createStringPairs()), MULTI_OPERATION_RUNS, MULTI_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set number primitive"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiSet(createNumberPairs()), MULTI_OPERATION_RUNS, MULTI_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set empty object"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiSet(createEmptyObjectPairs()), MULTI_OPERATION_RUNS, MULTI_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set sample report object"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiSet(createReportActionObjectPairs()), MULTI_OPERATION_RUNS, MULTI_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set sample report object with half nulls"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiSet(createReportActionObjectPairs(true)), MULTI_OPERATION_RUNS, MULTI_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Validate write"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    const pairs = createReportActionObjectPairs();
                    validateWrite(
                        pairs.map((p) => p[0]),
                        pairs.map((p) => p[1]),
                        (keys, data) => Onyx.storage.multiSet(keys.map((key, index) => [key, data[index]])),
                    );
                }}
            />

            <Text style={[styles.h1, styles.mb2, styles.ph5]}>mergeItem</Text>
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge null"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.mergeItem(ONYXKEYS.DB_TEST_DATA, null), SINGLE_OPERATION_RUNS, SINGLE_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge string primitive"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.mergeItem(ONYXKEYS.DB_TEST_DATA, 'something'), SINGLE_OPERATION_RUNS, SINGLE_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge number primitive"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.mergeItem(ONYXKEYS.DB_TEST_DATA, 0), SINGLE_OPERATION_RUNS, SINGLE_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge empty object"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.mergeItem(ONYXKEYS.DB_TEST_DATA, {}), SINGLE_OPERATION_RUNS, SINGLE_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge sample report object"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.mergeItem(ONYXKEYS.DB_TEST_DATA, createRandomReportAction(1)), SINGLE_OPERATION_RUNS, SINGLE_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Validate write"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    validateWrite([ONYXKEYS.DB_TEST_DATA], createRandomReportAction(1), ([key], data) => Onyx.storage.mergeItem(key, data));
                }}
            />

            <Text style={[styles.h1, styles.mb2, styles.ph5]}>multiMerge</Text>
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge null"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiMerge(createNullPairs()), MULTI_OPERATION_RUNS, MULTI_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge string primitive"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiMerge(createStringPairs()), MULTI_OPERATION_RUNS, MULTI_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge number primitive"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiMerge(createNumberPairs()), MULTI_OPERATION_RUNS, MULTI_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge empty object"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiMerge(createEmptyObjectPairs()), MULTI_OPERATION_RUNS, MULTI_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge sample report object"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiMerge(createReportActionObjectPairs()), MULTI_OPERATION_RUNS, MULTI_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge sample report object with half nulls"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiMerge(createReportActionObjectPairs(true)), MULTI_OPERATION_RUNS, MULTI_OPERATION_SLEEP_TIME_MS);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Validate write"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    const pairs = createReportActionObjectPairs();
                    validateWrite(
                        pairs.map((p) => p[0]),
                        pairs.map((p) => p[1]),
                        (keys, data) => Onyx.storage.multiMerge(keys.map((key, index) => [key, data[index]])),
                    );
                }}
            />
        </>
    );
}

export default DBWriteTest;
