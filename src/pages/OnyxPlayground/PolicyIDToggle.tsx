/* eslint-disable rulesdir/prefer-onyx-connect-in-libs */
/* eslint-disable rulesdir/prefer-actions-set-data */
import React from 'react';
// eslint-disable-next-line no-restricted-imports
import Onyx, {useOnyx} from 'react-native-onyx';
import * as Expensicons from '@components/Icon/Expensicons';
import MenuItem from '@components/MenuItem';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';
import ONYXKEYS from '@src/ONYXKEYS';

function PolicyIDToggle() {
    const styles = useThemeStyles();
    const [policyID] = useOnyx(ONYXKEYS.POLICY_ID);

    return (
        <>
            <Text style={[styles.textHeadline, styles.mb2, styles.ph5]}>POLICY_ID</Text>
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Toggle between existing policies"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    Onyx.merge(ONYXKEYS.POLICY_ID, policyID === 'D6863B3E467F1FA7' ? 'C18144AC34DB21EC' : 'D6863B3E467F1FA7');
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Toggle between existing and inexistent policies"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    Onyx.merge(ONYXKEYS.POLICY_ID, policyID === 'D6863B3E467F1FA7' ? 'inexistent1' : 'D6863B3E467F1FA7');
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Change policy name"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {name: Math.random().toString()});
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Change policy owner"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {owner: Math.random().toString()});
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Change policy multiple times with MERGE"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    Onyx.merge(ONYXKEYS.POLICY_ID, 'C18144AC34DB21EC');
                    Onyx.merge(ONYXKEYS.POLICY_ID, 'inexistent1');
                    Onyx.merge(ONYXKEYS.POLICY_ID, 'D6863B3E467F1FA7');
                    Onyx.merge(ONYXKEYS.POLICY_ID, 'inexistent2');
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Change policy multiple times with SET"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    Onyx.set(ONYXKEYS.POLICY_ID, 'C18144AC34DB21EC');
                    Onyx.set(ONYXKEYS.POLICY_ID, 'inexistent1');
                    Onyx.set(ONYXKEYS.POLICY_ID, 'D6863B3E467F1FA7');
                    Onyx.set(ONYXKEYS.POLICY_ID, 'inexistent2');
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Add entry to INEXISTENT collection"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    const id = String(Math.random());
                    // Onyx.merge(`${ONYXKEYS.COLLECTION.INEXISTENT}${'id1'}`, {id});
                    Onyx.merge(`${ONYXKEYS.COLLECTION.INEXISTENT}${id}`, {id});
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Clear INEXISTENT collection"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    const connection = Onyx.connectWithoutView({
                        key: ONYXKEYS.COLLECTION.INEXISTENT,
                        callback: (data) => {
                            for (const key of Object.keys(data ?? {})) {
                                Onyx.set(key as `${typeof ONYXKEYS.COLLECTION.INEXISTENT}${string}`, null);
                            }

                            Onyx.disconnect(connection);
                        },
                        waitForCollectionCallback: true,
                    });
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set TEST_CONDITION value"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    // Onyx.merge(ONYXKEYS.TEST_CONDITION, true);
                    Onyx.merge(ONYXKEYS.TEST_CONDITION, false);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Clear TEST_CONDITION value"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    Onyx.set(ONYXKEYS.TEST_CONDITION, null);
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Test merges with undefined"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    // 1. Merge key with `undefined` at root level.
                    // Doesn't produce any results ✅
                    // TS complains about it ✅
                    // Onyx.merge(ONYXKEYS.POLICY_ID, undefined);
                    // 2. Merge collection key with `undefined` at root level.
                    // Doesn't produce any results ✅
                    // TS complains about it ✅
                    // Onyx.merge(ONYXKEYS.COLLECTION.INEXISTENT, undefined);
                    // 3. Merge collection key with `undefined` at property level.
                    // Doesn't produce any results ✅
                    // TS complains about it ✅
                    // Onyx.merge(`${ONYXKEYS.COLLECTION.INEXISTENT}${'id1'}`, undefined);
                    // 4. Merge collection key with `undefined` at record level.
                    // Doesn't produce any results ✅
                    // TS DOESN'T complain about it ❌
                    // Onyx.merge(`${ONYXKEYS.COLLECTION.INEXISTENT}${'id1'}`, {id: undefined});
                }}
            />
        </>
    );
}

export default PolicyIDToggle;
