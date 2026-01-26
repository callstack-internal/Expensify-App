/* eslint-disable no-console */
/* eslint-disable rulesdir/prefer-onyx-connect-in-libs */
import {useEffect} from 'react';
// eslint-disable-next-line no-restricted-imports
import Onyx, {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';

function OnyxConnectTest() {
    const [policyID] = useOnyx(ONYXKEYS.POLICY_ID);

    useEffect(() => {
        const policyIdConnection = Onyx.connectWithoutView({
            key: ONYXKEYS.POLICY_ID,
            callback: (value) => {
                console.log(`OnyxPlayground [App] OnyxConnectTest ${ONYXKEYS.POLICY_ID}`, value);
            },
        });

        const policiesConnection = Onyx.connectWithoutView({
            key: ONYXKEYS.COLLECTION.POLICY,
            callback: (value) => {
                console.log(`OnyxPlayground [App] OnyxConnectTest ${ONYXKEYS.COLLECTION.POLICY}`, value);
            },
            waitForCollectionCallback: true,
        });

        const policyConnection = Onyx.connectWithoutView({
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            callback: (value) => {
                console.log(`OnyxPlayground [App] OnyxConnectTest ${ONYXKEYS.COLLECTION.POLICY}${policyID}`, value);
            },
        });

        return () => {
            Onyx.disconnect(policyIdConnection);
            Onyx.disconnect(policiesConnection);
            Onyx.disconnect(policyConnection);
        };
    });

    return null;
}

export default OnyxConnectTest;
