/* eslint-disable */
import React, {useEffect} from 'react';
import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import Text from './Text';

let result: unknown;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.TEST_UPDATE,
    waitForCollectionCallback: true,
    callback: (value) => {
        console.log('CALLBACK called with value:', result);
        result = value;
    },
});

function TestComponent1() {
    const applyData = async () => {
        await Onyx.multiSet({
            [`${ONYXKEYS.COLLECTION.TEST_UPDATE}entry1`]: {
                id: 'entry1',
                someKey: 'someValue',
            } as any,
        });

        // Removing the entire object in this merge.
        // Any subsequent changes to this key should completely replace the old value.
        Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_UPDATE}entry1`, null);

        // This change should completely replace `${ONYX_KEYS.COLLECTION.TEST_UPDATE}entry1` old value.
        Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_UPDATE}entry1`, {
            someKey: 'someValueChanged',
        });
    };

    useEffect(() => {
        applyData();
    }, []);

    return <Text style={{backgroundColor: 'orange'}}>Tests how Onyx.connect works</Text>;
}

export default TestComponent1;
