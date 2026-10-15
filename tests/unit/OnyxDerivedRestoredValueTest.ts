import initOnyxDerivedValues from '@userActions/OnyxDerived';
import * as OnyxDerivedUtils from '@userActions/OnyxDerived/utils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

import Onyx from 'react-native-onyx';

import getOnyxValue from '../utils/getOnyxValue';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';

const GUIDE_ACCOUNT_ID = 8;
const GUIDE_LOGIN = `guide@${CONST.EMAIL.GUIDES_DOMAIN}`;

describe('OnyxDerived with a value restored from disk', () => {
    it('should not rewrite a restored value when compute returns it unchanged', async () => {
        // Given the login to accountID map and its personal details are already stored, as after an app restart
        Onyx.init({keys: ONYXKEYS});
        await Onyx.multiSet({
            [ONYXKEYS.PERSONAL_DETAILS_LIST]: {[GUIDE_ACCOUNT_ID]: {accountID: GUIDE_ACCOUNT_ID, login: GUIDE_LOGIN}},
            [ONYXKEYS.DERIVED.LOGIN_TO_ACCOUNT_ID_MAP]: {[GUIDE_LOGIN]: GUIDE_ACCOUNT_ID},
        });
        await waitForBatchedUpdates();
        const setDerivedValueSpy = jest.spyOn(OnyxDerivedUtils, 'setDerivedValue');

        // When the engine starts and runs its first compute from scratch
        initOnyxDerivedValues();
        await waitForBatchedUpdates();

        // Then the restored value is kept as it is, without another write
        const loginMapWrites = setDerivedValueSpy.mock.calls.filter(([key]) => key === ONYXKEYS.DERIVED.LOGIN_TO_ACCOUNT_ID_MAP);
        expect(loginMapWrites).toHaveLength(0);
        expect(await getOnyxValue(ONYXKEYS.DERIVED.LOGIN_TO_ACCOUNT_ID_MAP)).toEqual({[GUIDE_LOGIN]: GUIDE_ACCOUNT_ID});
    });
});
