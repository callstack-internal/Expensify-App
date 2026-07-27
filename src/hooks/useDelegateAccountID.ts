import ONYXKEYS from '@src/ONYXKEYS';
import type {PersonalDetailsList} from '@src/types/onyx';

import type {OnyxEntry} from 'react-native-onyx';

import {delegateEmailSelector} from '@selectors/Account';
import OnyxUtils from 'react-native-onyx/dist/OnyxUtils';

import useOnyx from './useOnyx';

/**
 * Synchronous, event-time equivalent of `useDelegateAccountID`. Reads from the Onyx cache so it can be
 * called inside event handlers without any render-bound subscriptions.
 */
function getDelegateAccountIDSync(): number | undefined {
    const lowerEmail = delegateEmailSelector(OnyxUtils.get(ONYXKEYS.ACCOUNT)).toLowerCase();
    if (!lowerEmail) {
        return undefined;
    }
    const personalDetails = OnyxUtils.get(ONYXKEYS.PERSONAL_DETAILS_LIST);
    for (const detail of Object.values(personalDetails ?? {})) {
        if (detail?.login?.toLowerCase() === lowerEmail) {
            return detail.accountID;
        }
    }
    return undefined;
}

function useDelegateAccountID(): number | undefined {
    const [delegateEmail] = useOnyx(ONYXKEYS.ACCOUNT, {selector: delegateEmailSelector});
    const lowerEmail = delegateEmail?.toLowerCase();

    const [accountID] = useOnyx(ONYXKEYS.PERSONAL_DETAILS_LIST, {
        selector: (personalDetails: OnyxEntry<PersonalDetailsList>) => {
            if (!lowerEmail || !personalDetails) {
                return undefined;
            }
            for (const detail of Object.values(personalDetails)) {
                if (detail?.login?.toLowerCase() === lowerEmail) {
                    return detail.accountID;
                }
            }
            return undefined;
        },
    });

    return accountID;
}

export default useDelegateAccountID;
export {getDelegateAccountIDSync};
