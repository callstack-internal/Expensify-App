import createOnyxSelector from '@libs/createOnyxSelector';

import ONYXKEYS from '@src/ONYXKEYS';
import type {PersonalDetailsList} from '@src/types/onyx';

import type {OnyxEntry} from 'react-native-onyx';

import {delegateEmailSelector} from '@selectors/Account';

import useOnyx from './useOnyx';
import {useAllPersonalDetails} from './usePersonalDetails';

// The email is an arg of the shared memo rather than a closure, so every instance hits the same cache entry.
const accountIDByLogin = createOnyxSelector(function accountIDByLogin(personalDetails: OnyxEntry<PersonalDetailsList>, lowerEmail: string | undefined) {
    if (!lowerEmail || !personalDetails) {
        return undefined;
    }
    for (const detail of Object.values(personalDetails)) {
        if (detail?.login?.toLowerCase() === lowerEmail) {
            return detail.accountID;
        }
    }
    return undefined;
});

const accountIDByLoginSelector = (lowerEmail: string | undefined) =>
    function accountIDByLoginSelector(personalDetails: OnyxEntry<PersonalDetailsList>) {
        return accountIDByLogin(personalDetails, lowerEmail);
    };

function useDelegateAccountID(): number | undefined {
    const [delegateEmail] = useOnyx(ONYXKEYS.ACCOUNT, {selector: delegateEmailSelector});
    const [accountID] = useAllPersonalDetails(accountIDByLoginSelector(delegateEmail?.toLowerCase()));

    return accountID;
}

export default useDelegateAccountID;
