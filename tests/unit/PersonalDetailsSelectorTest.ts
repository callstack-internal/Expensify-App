import type {LocalizedTranslate} from '@components/LocaleContextProvider';

import {temporaryGetDisplayNameOrDefault} from '@libs/PersonalDetailsUtils';

import CONST from '@src/CONST';
import type {PersonalDetails, PersonalDetailsList} from '@src/types/onyx';

import {
    accountIDsByLoginsSelector,
    createDisplayDetailsByAccountIDsSelector,
    loginToAccountIDMapSelector,
    multiPersonalDetailsSelector,
    personalDetailsDisplayNameSelector,
    personalDetailsListSelector,
    personalDetailsLoginSelector,
    personalDetailsLoginsSelector,
    personalDetailsSelector,
} from '@selectors/PersonalDetails';

import createMock from '../utils/createMock';
import {formatPhoneNumber, translateLocal} from '../utils/TestHelper';

describe('PersonalDetailsSelector', () => {
    const accountID = 123;
    const personalDetails = {
        accountID,
        displayName: 'Test User',
        login: 'test@user.com',
    };
    const personalDetailsList = createMock<PersonalDetailsList>({
        [accountID]: personalDetails,
    });
    describe('personalDetailsSelector', () => {
        it('should return the personal details for the given accountID', () => {
            const result = personalDetailsSelector(accountID)(personalDetailsList);
            expect(result).toEqual(personalDetails);
        });

        it('should return undefined if the accountID is not in the list', () => {
            const result = personalDetailsSelector(999)(personalDetailsList);
            expect(result).toBeUndefined();
        });

        it('should return undefined if the personalDetailsList is undefined', () => {
            const result = personalDetailsSelector(accountID)(undefined);
            expect(result).toBeUndefined();
        });
    });

    describe('personalDetailsDisplayNameSelector', () => {
        it('should return the display name for the given accountID', () => {
            const result = personalDetailsDisplayNameSelector(accountID, translateLocal, formatPhoneNumber)(personalDetailsList);
            expect(result).toEqual(temporaryGetDisplayNameOrDefault({passedPersonalDetails: personalDetails, translate: translateLocal, formatPhoneNumber}));
        });

        it('should return concierge display name for concierge accountID', () => {
            const conciergeDetails = {
                accountID: CONST.ACCOUNT_ID.CONCIERGE,
                displayName: 'Some Other Name',
                login: 'concierge@expensify.com',
            };
            const list = createMock<PersonalDetailsList>({
                [CONST.ACCOUNT_ID.CONCIERGE]: conciergeDetails,
            });

            const result = personalDetailsDisplayNameSelector(CONST.ACCOUNT_ID.CONCIERGE, translateLocal, formatPhoneNumber)(list);
            expect(result).toBe(CONST.CONCIERGE_DISPLAY_NAME);
        });

        it('should return login when displayName is missing', () => {
            const personalDetailsWithLoginOnly = {
                accountID,
                login: 'fallback@user.com',
            };
            const list = createMock<PersonalDetailsList>({
                [accountID]: personalDetailsWithLoginOnly,
            });

            const result = personalDetailsDisplayNameSelector(accountID, translateLocal, formatPhoneNumber)(list);
            expect(result).toBe('fallback@user.com');
        });

        it('should return default display name if the accountID is not in the list', () => {
            const result = personalDetailsDisplayNameSelector(999, translateLocal, formatPhoneNumber)(personalDetailsList);
            expect(result).toEqual(temporaryGetDisplayNameOrDefault({translate: translateLocal, formatPhoneNumber}));
        });

        it('should return default display name if the personalDetailsList is undefined', () => {
            const result = personalDetailsDisplayNameSelector(accountID, translateLocal, formatPhoneNumber)(undefined);
            expect(result).toEqual(temporaryGetDisplayNameOrDefault({translate: translateLocal, formatPhoneNumber}));
        });

        it('should resolve the hidden fallback through the provided translate function', () => {
            const translateWithHiddenMarker: LocalizedTranslate = (path, ...parameters) => (path === 'common.hidden' ? 'HiddenMarker' : translateLocal(path, ...parameters));

            const result = personalDetailsDisplayNameSelector(999, translateWithHiddenMarker, formatPhoneNumber)(personalDetailsList);

            expect(result).toBe('HiddenMarker');
        });
    });

    describe('personalDetailsLoginSelector', () => {
        it('should return the personal details login for the given accountID', () => {
            const result = personalDetailsLoginSelector(accountID)(personalDetailsList);
            expect(result).toEqual(personalDetails.login);
        });

        it('should return undefined if the accountID is not in the list', () => {
            const result = personalDetailsLoginSelector(999)(personalDetailsList);
            expect(result).toBeUndefined();
        });

        it('should return undefined if the personalDetailsList is undefined', () => {
            const result = personalDetailsLoginSelector(accountID)(undefined);
            expect(result).toBeUndefined();
        });
    });

    describe('personalDetailsLoginsSelector', () => {
        const secondAccountID = 456;
        const secondPersonalDetails = {
            accountID: secondAccountID,
            displayName: 'Second User',
            login: 'second@user.com',
        };
        const multiPersonalDetailsList: PersonalDetailsList = {
            [accountID]: personalDetails,
            [secondAccountID]: secondPersonalDetails,
        };

        it('should return the logins for the given accountIDs', () => {
            const result = personalDetailsLoginsSelector([accountID, secondAccountID])(multiPersonalDetailsList);
            expect(result).toEqual([personalDetails.login, secondPersonalDetails.login]);
        });

        it('should filter out accountIDs that do not exist in the list', () => {
            const result = personalDetailsLoginsSelector([accountID, 999])(multiPersonalDetailsList);
            expect(result).toEqual([personalDetails.login]);
        });

        it('should return an empty array if accountIDs is empty', () => {
            const result = personalDetailsLoginsSelector([])(multiPersonalDetailsList);
            expect(result).toEqual([]);
        });

        it('should return an empty array if none of the accountIDs exist in the list', () => {
            const result = personalDetailsLoginsSelector([888, 999])(multiPersonalDetailsList);
            expect(result).toEqual([]);
        });
    });

    describe('multiPersonalDetailsSelector', () => {
        it('should return the personal details for the given accountIDs', () => {
            const result = multiPersonalDetailsSelector([accountID])(personalDetailsList);
            expect(result).toEqual([personalDetails]);
        });

        it('should filter out accountIDs that do not exist in the list', () => {
            const result = multiPersonalDetailsSelector([accountID, 999])(personalDetailsList);
            expect(result).toEqual([personalDetails]);
        });

        it('should return an empty array if accountIDs is empty', () => {
            const result = multiPersonalDetailsSelector([])(personalDetailsList);
            expect(result).toEqual([]);
        });

        it('should return an empty array if accountIDs is undefined', () => {
            const result = multiPersonalDetailsSelector(undefined)(personalDetailsList);
            expect(result).toEqual([]);
        });

        it('should return an empty array if the personalDetailsList is undefined', () => {
            const result = multiPersonalDetailsSelector([accountID])(undefined);
            expect(result).toEqual([]);
        });
    });

    describe('personalDetailsListSelector', () => {
        it('should return the personal details list for the given accountIDs', () => {
            const result = personalDetailsListSelector([accountID])(personalDetailsList);
            expect(result).toEqual(personalDetailsList);
        });

        it('should filter out accountIDs that do not exist in the list', () => {
            const result = personalDetailsListSelector([accountID, 999])(personalDetailsList);
            expect(result).toEqual(personalDetailsList);
        });

        it('should return an empty object if accountIDs is empty', () => {
            const result = personalDetailsListSelector([])(personalDetailsList);
            expect(result).toEqual({});
        });

        it('should return an empty object if the personalDetailsList is undefined', () => {
            const result = personalDetailsListSelector([accountID])(undefined);
            expect(result).toEqual({});
        });
    });

    describe('createDisplayDetailsByAccountIDsSelector', () => {
        const fullDetails = createMock<PersonalDetails>({
            accountID,
            displayName: 'Test User',
            login: 'test@user.com',
            avatar: 'https://example.com/avatar.png',
            pronouns: 'they/them',
            timezone: {selected: 'Europe/London'},
        });
        const listWithAvatar = createMock<PersonalDetailsList>({[accountID]: fullDetails});

        it('should return only the display detail fields for present account IDs', () => {
            const result = createDisplayDetailsByAccountIDsSelector([accountID])(listWithAvatar);
            expect(result).toEqual({
                [accountID]: {
                    accountID,
                    displayName: 'Test User',
                    login: 'test@user.com',
                    avatar: 'https://example.com/avatar.png',
                },
            });
        });

        it('should not include extra fields beyond accountID, displayName, login, avatar', () => {
            const result = createDisplayDetailsByAccountIDsSelector([accountID])(listWithAvatar);
            const keys = Object.keys(result[accountID] ?? {});
            expect(keys.sort()).toEqual(['accountID', 'avatar', 'displayName', 'login']);
        });

        it('should skip account IDs that are not in the list', () => {
            const result = createDisplayDetailsByAccountIDsSelector([accountID, 999])(listWithAvatar);
            expect(Object.keys(result)).toEqual([String(accountID)]);
        });

        it('should return an empty object for an empty account IDs array', () => {
            const result = createDisplayDetailsByAccountIDsSelector([])(listWithAvatar);
            expect(result).toEqual({});
        });

        it('should return an empty object when personalDetailsList is undefined', () => {
            const result = createDisplayDetailsByAccountIDsSelector([accountID])(undefined);
            expect(result).toEqual({});
        });
    });

    describe('loginToAccountIDMapSelector', () => {
        const accountID1 = 1;
        const accountID2 = 2;
        const login = 'user1@example.com';

        it('should return an empty map when there are no personal details', () => {
            // Given no personal details, or an empty list
            // When the login map is selected
            // Then no login resolves to an account
            expect(loginToAccountIDMapSelector(undefined)).toEqual({});
            expect(loginToAccountIDMapSelector({})).toEqual({});
        });

        it('should key the map by the lowercased login and skip entries without one', () => {
            // Given a login with capitals next to an entry without a login
            const list: PersonalDetailsList = {
                [accountID1]: {accountID: accountID1, login: 'User1@Example.com'},
                [accountID2]: {accountID: accountID2},
            };

            // When the login map is selected
            // Then the login is lowercased, since logins are case-insensitive, and the entry without a login is left out
            expect(loginToAccountIDMapSelector(list)).toEqual({[login]: accountID1});
        });

        it('should prefer the live account when a closed merged-away account shares the same login, regardless of order', () => {
            // Given a live and a closed account with the same login, in both key orders
            const closedHasHigherAccountID: PersonalDetailsList = {
                [accountID1]: {accountID: accountID1, login},
                [accountID2]: {accountID: accountID2, login, isClosed: true},
            };
            const closedHasLowerAccountID: PersonalDetailsList = {
                [accountID1]: {accountID: accountID1, login, isClosed: true},
                [accountID2]: {accountID: accountID2, login},
            };

            // When the login map is selected
            // Then the login resolves to the live account, since the closed one was merged away
            expect(loginToAccountIDMapSelector(closedHasHigherAccountID)).toEqual({[login]: accountID1});
            expect(loginToAccountIDMapSelector(closedHasLowerAccountID)).toEqual({[login]: accountID2});
        });

        it('should prefer the real account when an optimistic personal detail shares the same login, regardless of order', () => {
            // Given a real account and an optimistic one with the same login, in both key orders
            const optimisticHasHigherAccountID: PersonalDetailsList = {
                [accountID1]: {accountID: accountID1, login},
                [accountID2]: {accountID: accountID2, login, isOptimisticPersonalDetail: true},
            };
            const optimisticHasLowerAccountID: PersonalDetailsList = {
                [accountID1]: {accountID: accountID1, login, isOptimisticPersonalDetail: true},
                [accountID2]: {accountID: accountID2, login},
            };

            // When the login map is selected
            // Then the login resolves to the real account, since the optimistic one is a placeholder
            expect(loginToAccountIDMapSelector(optimisticHasHigherAccountID)).toEqual({[login]: accountID1});
            expect(loginToAccountIDMapSelector(optimisticHasLowerAccountID)).toEqual({[login]: accountID2});
        });

        it('should return the same map for the same personal details list', () => {
            // Given one personal details list
            const list: PersonalDetailsList = {[accountID1]: {accountID: accountID1, login}};

            // When the login map is selected twice, as two Search rows do after the same write
            // Then both get the same object, so the map is built once per list
            expect(loginToAccountIDMapSelector(list)).toBe(loginToAccountIDMapSelector(list));
        });
    });

    describe('accountIDsByLoginsSelector', () => {
        const accountID1 = 1;
        const accountID2 = 2;
        const login1 = 'user1@example.com';
        const login2 = 'user2@example.com';

        it('should return the accountID of each login in order, with the default ID for unknown or missing logins', () => {
            // Given two known accounts
            const list: PersonalDetailsList = {
                [accountID1]: {accountID: accountID1, login: login1},
                [accountID2]: {accountID: accountID2, login: login2},
            };

            // When the accountIDs of two known logins, an unknown login and a missing one are selected
            // Then each position holds its account, and the rest fall back to the default ID like a failed map lookup did
            expect(accountIDsByLoginsSelector([login2, login1, 'nobody@example.com', undefined])(list)).toEqual([accountID2, accountID1, CONST.DEFAULT_NUMBER_ID, CONST.DEFAULT_NUMBER_ID]);
        });

        it('should select a deep-equal array when a user who is not in the logins changes', () => {
            // Given an attendee and an unrelated user, before and after the unrelated user is renamed
            const before: PersonalDetailsList = {
                [accountID1]: {accountID: accountID1, login: login1},
                [accountID2]: {accountID: accountID2, login: login2, displayName: 'Before'},
            };
            const after: PersonalDetailsList = {
                ...before,
                [accountID2]: {accountID: accountID2, login: login2, displayName: 'After'},
            };

            // When the attendee's accountID is selected from both
            // Then both selections are equal, so useOnyx's deep-equal check skips the Search row re-render
            expect(accountIDsByLoginsSelector([login1])(after)).toEqual(accountIDsByLoginsSelector([login1])(before));
        });
    });
});
