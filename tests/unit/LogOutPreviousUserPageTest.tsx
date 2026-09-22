import {render} from '@testing-library/react-native';

import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';

import type {AuthScreensParamList} from '@navigation/types';

import LogOutPreviousUserPage from '@pages/LogOutPreviousUserPage';

import {signOutAndRedirectToSignIn} from '@userActions/Session';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';

import React from 'react';
import Onyx from 'react-native-onyx';

import createMock from '../utils/createMock';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';
import wrapOnyxWithWaitForBatchedUpdates from '../utils/wrapOnyxWithWaitForBatchedUpdates';

const ACTOR = 'actor@example.com';
const DELEGATOR = 'delegator@example.com';
const UNRELATED = 'unrelated@example.com';

jest.mock('@components/InitialURLContextProvider', () => ({
    useInitialURLState: () => ({initialURL: `https://new.expensify.com/transition?email=${ACTOR}&shortLivedAuthToken=token`, isAuthenticatedAtStartup: false}),
    useInitialURLActions: () => ({setIsAuthenticatedAtStartup: jest.fn()}),
}));

jest.mock('@libs/Navigation/Navigation', () => ({
    __esModule: true,
    default: {
        isNavigationReady: jest.fn(() => Promise.resolve()),
        goBack: jest.fn(),
        navigate: jest.fn(),
    },
}));

jest.mock('@userActions/Session', () => ({
    ...jest.requireActual<Record<string, unknown>>('@userActions/Session'),
    signOutAndRedirectToSignIn: jest.fn(),
    signInWithShortLivedAuthToken: jest.fn(),
    signInWithSupportAuthToken: jest.fn(),
}));

type TransitionScreenProps = PlatformStackScreenProps<AuthScreensParamList, typeof SCREENS.TRANSITION_BETWEEN_APPS>;

function renderLogOutPreviousUserPage() {
    return render(
        <LogOutPreviousUserPage
            route={createMock<TransitionScreenProps['route']>({params: {shortLivedAuthToken: 'token'}})}
            navigation={createMock<TransitionScreenProps['navigation']>({})}
        />,
    );
}

describe('LogOutPreviousUserPage', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        wrapOnyxWithWaitForBatchedUpdates(Onyx);
        await Onyx.clear();
        await waitForBatchedUpdates();
    });

    it('keeps a copilot signed in when the transition link was generated for the copilot themselves', async () => {
        // Given: a live copilot session on the delegator account, and a transition link whose email is the copilot's own address
        await Onyx.merge(ONYXKEYS.SESSION, {accountID: 1, email: DELEGATOR, authTokenType: CONST.AUTH_TOKEN_TYPES.DELEGATE});
        await waitForBatchedUpdates();

        // When: the transition page mounts
        renderLogOutPreviousUserPage();
        await waitForBatchedUpdatesWithAct();

        // Then: nobody is signed out, so the copilot session survives the transition
        expect(signOutAndRedirectToSignIn).not.toHaveBeenCalled();
    });

    it('still signs the previous user out when a different person arrives over the same transition link', async () => {
        // Given: an ordinary session belonging to someone the link does not name
        await Onyx.merge(ONYXKEYS.SESSION, {accountID: 2, email: UNRELATED});
        await waitForBatchedUpdates();

        // When: the transition page mounts
        renderLogOutPreviousUserPage();
        await waitForBatchedUpdatesWithAct();

        // Then: the previous user is signed out for the new one
        expect(signOutAndRedirectToSignIn).toHaveBeenCalledWith(false, false, true, undefined, CONST.SIGN_OUT_REASON.LOGIN_AS_NEW_USER);
    });
});
