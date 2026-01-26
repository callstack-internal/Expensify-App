/* eslint-disable rulesdir/prefer-actions-set-data */
/* eslint-disable no-console */
import React from 'react';
// eslint-disable-next-line no-restricted-imports
import Onyx, {useOnyx} from 'react-native-onyx';
import * as Expensicons from '@components/Icon/Expensicons';
import MenuItem from '@components/MenuItem';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';
import ONYXKEYS from '@src/ONYXKEYS';

function InitWithStoredValuesUseOnyx() {
    const policyID = useOnyx(ONYXKEYS.POLICY_ID, {
        // selector: (v) => `${v}_selector`,
        // initialValue: 'INITIAL VALUE',
        initWithStoredValues: false,
    });
    console.log(`OnyxPlayground [App] InitWithStoredValuesUseOnyx policyID`, policyID);
    return <Text>{policyID[0]}</Text>;
}

function InitWithStoredValuesTest() {
    const styles = useThemeStyles();

    return (
        <>
            <Text style={[styles.textHeadline, styles.mb2, styles.ph5]}>initWithStoredValues</Text>
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Set value to POLICY_ID"
                icon={Expensicons.Sync}
                numberOfLinesTitle={2}
                onPress={() => {
                    Onyx.merge(ONYXKEYS.POLICY_ID, 'something');
                }}
            />
            <Text>
                InitWithStoredValuesUseOnyx -<InitWithStoredValuesUseOnyx />
            </Text>
        </>
    );
}

export default InitWithStoredValuesTest;
