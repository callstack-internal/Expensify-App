/* eslint-disable no-console */
/* eslint-disable rulesdir/prefer-actions-set-data */
import React, {useState} from 'react';
import {View} from 'react-native';
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

const createKeys = (key = ONYXKEYS.COLLECTION.DB_COLLECTION_TEST_DATA, length = 1000) => Array.from(Array(length).keys()).map((index) => `${key}${index + 1}`);
const createNullPairs = () =>
    createDBPairs(
        (item, index) => `${ONYXKEYS.COLLECTION.DB_COLLECTION_TEST_DATA}${index}`,
        () => null,
    );
const createStringPairs = () =>
    createDBPairs(
        (item, index) => `${ONYXKEYS.COLLECTION.DB_COLLECTION_TEST_DATA}${index}`,
        (index) => `string_${index}`,
    );
const createNumberPairs = () =>
    createDBPairs(
        (item, index) => `${ONYXKEYS.COLLECTION.DB_COLLECTION_TEST_DATA}${index}`,
        (index) => index,
    );
const createEmptyObjectPairs = () =>
    createDBPairs(
        (item, index) => `${ONYXKEYS.COLLECTION.DB_COLLECTION_TEST_DATA}${index}`,
        () => {},
    );
const createReportActionObjectPairs = (shouldCreateNullEntries?: boolean) =>
    createDBPairs<ReportAction | null>(
        (item, index) => `${ONYXKEYS.COLLECTION.DB_COLLECTION_TEST_DATA}${item?.reportActionID ?? index}`,
        // eslint-disable-next-line no-nested-ternary
        (index) => (shouldCreateNullEntries ? (index % 2 === 0 ? null : createRandomReportAction(index)) : createRandomReportAction(index)),
    );

function DBWriteTest() {
    const styles = useThemeStyles();
    const [shouldWrite1000x, setShouldWrite1000x] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [dbTestData] = useOnyx(ONYXKEYS.DB_TEST_DATA);

    console.log('OnyxPlayground [App] DBWriteTest dbTestData', dbTestData);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-redundant-type-constituents
    const performWriteOperation = async (operation: () => any | Promise<any>, writes: number, sleepTime: number) => {
        if (shouldWrite1000x) {
            for (let i = 0; i < writes; i++) {
                operation();
                // eslint-disable-next-line no-await-in-loop
                await sleep(sleepTime);
            }
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const result = await operation();
            console.log('OnyxPlayground [App] DBWriteTest performWriteOperation', result);
        }
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
                        isOn={shouldWrite1000x}
                        onToggle={setShouldWrite1000x}
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
                    performWriteOperation(() => Onyx.storage.getItem(ONYXKEYS.DB_TEST_DATA), 100, 20);
                }}
            />

            <Text style={[styles.h1, styles.mb2, styles.ph5]}>multiGet</Text>
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Get item"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiGet(createKeys() as StorageKeyList), 100, 200);
                }}
            />

            <Text style={[styles.h1, styles.mb2, styles.ph5]}>setItem</Text>
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set null"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.setItem(ONYXKEYS.DB_TEST_DATA, null), 100, 20);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set string primitive"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.setItem(ONYXKEYS.DB_TEST_DATA, 'something'), 100, 20);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set number primitive"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.setItem(ONYXKEYS.DB_TEST_DATA, 0), 100, 20);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set empty object"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.setItem(ONYXKEYS.DB_TEST_DATA, {}), 100, 20);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set sample report object"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.setItem(ONYXKEYS.DB_TEST_DATA, createRandomReportAction(1)), 100, 20);
                }}
            />

            <Text style={[styles.h1, styles.mb2, styles.ph5]}>multiSet</Text>
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set null"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiSet(createNullPairs()), 100, 1000);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set string primitive"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiSet(createStringPairs()), 100, 200);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set number primitive"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiSet(createNumberPairs()), 100, 200);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set empty object"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiSet(createEmptyObjectPairs()), 100, 200);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set sample report object"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiSet(createReportActionObjectPairs()), 100, 200);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set sample report object with half nulls"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiSet(createReportActionObjectPairs(true)), 100, 200);
                }}
            />

            <Text style={[styles.h1, styles.mb2, styles.ph5]}>mergeItem</Text>
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge null"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.mergeItem(ONYXKEYS.DB_TEST_DATA, null), 100, 20);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge string primitive"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.mergeItem(ONYXKEYS.DB_TEST_DATA, 'something'), 100, 20);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge number primitive"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.mergeItem(ONYXKEYS.DB_TEST_DATA, 0), 100, 20);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge empty object"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.mergeItem(ONYXKEYS.DB_TEST_DATA, {}), 100, 20);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge sample report object"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.mergeItem(ONYXKEYS.DB_TEST_DATA, createRandomReportAction(1)), 100, 20);
                }}
            />

            <Text style={[styles.h1, styles.mb2, styles.ph5]}>multiMerge</Text>
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge null"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiMerge(createNullPairs()), 100, 200);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge string primitive"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiMerge(createStringPairs()), 100, 200);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge number primitive"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiMerge(createNumberPairs()), 100, 200);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge empty object"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiMerge(createEmptyObjectPairs()), 100, 200);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge sample report object"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiMerge(createReportActionObjectPairs()), 100, 200);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Merge sample report object with half nulls"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    performWriteOperation(() => Onyx.storage.multiMerge(createReportActionObjectPairs(true)), 100, 200);
                }}
            />
        </>
    );
}

export default DBWriteTest;
