/* eslint-disable no-console */
/* eslint-disable rulesdir/prefer-actions-set-data */
import React, {useState} from 'react';
// eslint-disable-next-line no-restricted-imports
import Onyx, {useOnyx} from 'react-native-onyx';
import * as Expensicons from '@components/Icon/Expensicons';
import MenuItem from '@components/MenuItem';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';
import ONYXKEYS from '@src/ONYXKEYS';
import mapOnyxCollectionItems from '@src/utils/mapOnyxCollectionItems';

function UseOnyxDependencyTest() {
    const styles = useThemeStyles();
    const [policyID] = useOnyx(ONYXKEYS.POLICY_ID);
    // eslint-disable-next-line react-hooks/purity
    const [internalValue, setInternalValue] = useState(`internal_${Math.random()}`);
    // eslint-disable-next-line rulesdir/no-inline-useOnyx-selector
    const [policies] = useOnyx(
        ONYXKEYS.COLLECTION.POLICY,
        {
            selector: (collection) =>
                mapOnyxCollectionItems(collection, (entry) => ({
                    id: entry?.id,
                    name: entry?.name,
                    internalValue,
                })),
        },
        [internalValue],
    );

    console.log('OnyxPlayground [App] UseOnyxDependencyTest policyID', policyID);
    console.log('OnyxPlayground [App] UseOnyxDependencyTest internalValue', internalValue);
    console.log('OnyxPlayground [App] UseOnyxDependencyTest policies', policies);

    return (
        <>
            <Text style={[styles.textHeadline, styles.mb2, styles.ph5]}>UseOnyxDependencyTest</Text>
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set value to POLICY_ID"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    Onyx.merge(ONYXKEYS.POLICY_ID, policyID === 'DE9A9D2285F076A2' ? '3B5E8F685F5DEF21' : 'DE9A9D2285F076A2');
                }}
            />
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set value to internal state"
                icon={Expensicons.Send}
                numberOfLinesTitle={2}
                onPress={() => {
                    setInternalValue(`internal_${Math.random()}`);
                }}
            />
        </>
    );
}

export default UseOnyxDependencyTest;
