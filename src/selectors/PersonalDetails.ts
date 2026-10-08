import type {LocaleContextProps, LocalizedTranslate} from '@components/LocaleContextProvider';

import {
    getLoginByAccountID,
    getLoginsByAccountIDs,
    getNewAccountIDsAndLogins,
    getPersonalDetailsByID,
    getPersonalDetailsListByIDs,
    getPersonalDetailsByIDs,
    temporaryGetDisplayNameOrDefault,
} from '@libs/PersonalDetailsUtils';

import CONST from '@src/CONST';
import type {InvitedEmailsToAccountIDs, PersonalDetails, PersonalDetailsList, Report} from '@src/types/onyx';
import {isEmptyObject} from '@src/types/utils/EmptyObject';

import type {OnyxEntry} from 'react-native-onyx';

const personalDetailsSelector = (accountID: number | undefined) => (personalDetailsList: OnyxEntry<PersonalDetailsList>) => getPersonalDetailsByID(accountID, personalDetailsList);

const multiPersonalDetailsSelector = (accountIDs: number[] | undefined) => (personalDetails: OnyxEntry<PersonalDetailsList>) => getPersonalDetailsByIDs(accountIDs, personalDetails);

const personalDetailsListSelector = (accountIDs: Array<number | undefined> | undefined) => (personalDetailsList: OnyxEntry<PersonalDetailsList>) =>
    getPersonalDetailsListByIDs(accountIDs, personalDetailsList);

const personalDetailsLoginSelector = (accountID: number | undefined) => (personalDetailsList: OnyxEntry<PersonalDetailsList>) => getLoginByAccountID(accountID, personalDetailsList);

const personalDetailsLoginsSelector = (accountIDs: number[] | undefined) => (personalDetailsList: OnyxEntry<PersonalDetailsList>) => getLoginsByAccountIDs(accountIDs, personalDetailsList);

const personalDetailsDisplayNameSelector =
    (accountID: number, translate: LocalizedTranslate, formatPhoneNumber: LocaleContextProps['formatPhoneNumber']) => (personalDetails: OnyxEntry<PersonalDetailsList>) =>
        temporaryGetDisplayNameOrDefault({
            passedPersonalDetails: personalDetails?.[accountID],
            translate,
            formatPhoneNumber,
        });

type DisplayDetails = Pick<PersonalDetails, 'accountID' | 'displayName' | 'login' | 'avatar'>;

/**
 * Creates a selector returning only the display details (name, login, avatar) of the given accounts,
 * so subscribers don't re-render when anything else in the personal details list changes.
 */
const createDisplayDetailsByAccountIDsSelector =
    (accountIDs: number[]) =>
    (personalDetailsList: OnyxEntry<PersonalDetailsList>): Record<number, DisplayDetails> => {
        const result: Record<number, DisplayDetails> = {};
        for (const accountID of accountIDs) {
            const detail = personalDetailsList?.[accountID];
            if (!detail) {
                continue;
            }
            result[accountID] = {
                accountID: detail.accountID,
                displayName: detail.displayName,
                login: detail.login,
                avatar: detail.avatar,
            };
        }
        return result;
    };

const doesPersonalDetailExistSelector =
    (accountID: number | undefined) =>
    (personalDetailsList: OnyxEntry<PersonalDetailsList>): boolean =>
        accountID !== undefined && !!personalDetailsList?.[accountID];

const accountIDToLoginSelector = (reportsToArchive: Report[]) => (personalDetailsList: OnyxEntry<PersonalDetailsList>) => {
    const map: Record<number, string> = {};
    for (const report of reportsToArchive) {
        const {ownerAccountID} = report;
        if (ownerAccountID && ownerAccountID !== CONST.POLICY.OWNER_ACCOUNT_ID_FAKE && personalDetailsList?.[ownerAccountID]?.login) {
            map[ownerAccountID] = personalDetailsList[ownerAccountID].login;
        }
    }
    return map;
};

function isPersonalDetailOptimistic(personalDetail: PersonalDetails | null | undefined): boolean {
    return isEmptyObject(personalDetail) || !!personalDetail?.isOptimisticPersonalDetail;
}

/**
 * Returns only the personal details that were created optimistically. The optimistic set is tiny compared to the whole
 * personal details list, so subscribers using it don't re-render every time an unrelated (server-backed) detail changes.
 */
const optimisticPersonalDetailsSelector = (personalDetailsList: OnyxEntry<PersonalDetailsList>): PersonalDetailsList => {
    const optimisticPersonalDetails: PersonalDetailsList = {};
    for (const [accountID, personalDetail] of Object.entries(personalDetailsList ?? {})) {
        if (!personalDetail?.isOptimisticPersonalDetail) {
            continue;
        }
        optimisticPersonalDetails[accountID] = personalDetail;
    }
    return optimisticPersonalDetails;
};

const loginToAccountIDMapCache = new WeakMap<PersonalDetailsList, Record<string, number>>();

/**
 * Maps each lowercased login to its accountID. When two accounts share a login, a closed or optimistic one loses to the other.
 * Cached on the list reference, so every Search row that reads it after the same write shares one build.
 */
const loginToAccountIDMapSelector = (personalDetailsList: OnyxEntry<PersonalDetailsList>): Record<string, number> => {
    if (!personalDetailsList) {
        return {};
    }

    const cachedLoginToAccountIDMap = loginToAccountIDMapCache.get(personalDetailsList);
    if (cachedLoginToAccountIDMap) {
        return cachedLoginToAccountIDMap;
    }

    const loginToAccountIDMap: Record<string, number> = {};
    for (const personalDetails of Object.values(personalDetailsList)) {
        if (!personalDetails?.login) {
            continue;
        }
        const login = personalDetails.login.toLowerCase();
        const existingAccountID = loginToAccountIDMap[login];
        const existingDetail = existingAccountID === undefined ? undefined : personalDetailsList[existingAccountID];
        if (!existingDetail || existingDetail.isClosed || existingDetail.isOptimisticPersonalDetail) {
            loginToAccountIDMap[login] = personalDetails.accountID;
        }
    }
    loginToAccountIDMapCache.set(personalDetailsList, loginToAccountIDMap);
    return loginToAccountIDMap;
};

const accountIDsByLoginsSelector = (logins: Array<string | undefined>) => (personalDetailsList: OnyxEntry<PersonalDetailsList>) => {
    const loginToAccountIDMap = loginToAccountIDMapSelector(personalDetailsList);
    return logins.map((login) => loginToAccountIDMap[login ?? ''] ?? CONST.DEFAULT_NUMBER_ID);
};

const newAccountIDsAndLoginsSelector = (invitedEmailsToAccountIDs: InvitedEmailsToAccountIDs | undefined) => (personalDetailsList: OnyxEntry<PersonalDetailsList>) =>
    getNewAccountIDsAndLogins(invitedEmailsToAccountIDs, personalDetailsList);

const displayNameSelector = (personalDetails: PersonalDetails | undefined) => personalDetails?.displayName;

const accountIDSelector = (personalDetails: PersonalDetails | undefined) => personalDetails?.accountID;

const loginSelector = (personalDetails: PersonalDetails | undefined) => personalDetails?.login;

const avatarStyleColorSelector = (personalDetails: PersonalDetails | undefined) => personalDetails?.avatarStyle?.color;

const doesPersonalDetailExist = (personalDetails: PersonalDetails | undefined) => !!personalDetails;

const firstNameSelector = (personalDetails: PersonalDetails | undefined) => (personalDetails?.firstName?.trim() ? personalDetails.firstName : undefined);

const displayNameOrDefaultSelector = (translate: LocalizedTranslate, formatPhoneNumber: LocaleContextProps['formatPhoneNumber']) => (personalDetails: PersonalDetails | undefined) =>
    temporaryGetDisplayNameOrDefault({passedPersonalDetails: personalDetails, translate, formatPhoneNumber});

export {
    avatarStyleColorSelector,
    personalDetailsSelector,
    multiPersonalDetailsSelector,
    personalDetailsListSelector,
    personalDetailsDisplayNameSelector,
    personalDetailsLoginSelector,
    personalDetailsLoginsSelector,
    doesPersonalDetailExistSelector,
    accountIDToLoginSelector,
    isPersonalDetailOptimistic,
    optimisticPersonalDetailsSelector,
    loginToAccountIDMapSelector,
    accountIDsByLoginsSelector,
    createDisplayDetailsByAccountIDsSelector,
    newAccountIDsAndLoginsSelector,
    displayNameSelector,
    accountIDSelector,
    loginSelector,
    firstNameSelector,
    displayNameOrDefaultSelector,
    doesPersonalDetailExist,
};
