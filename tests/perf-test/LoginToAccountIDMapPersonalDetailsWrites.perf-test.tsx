import {render, screen} from '@testing-library/react-native';

import ComposeProviders from '@components/ComposeProviders';
import {LocaleContextProvider} from '@components/LocaleContextProvider';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import AttendeesCell from '@components/Search/SearchList/ListItem/AttendeesCell';

import ONYXKEYS from '@src/ONYXKEYS';
import type {PersonalDetailsList} from '@src/types/onyx';
import type {Attendee} from '@src/types/onyx/IOU';

import React from 'react';
import {View} from 'react-native';
import Onyx from 'react-native-onyx';
import {measureAsyncFunction, measureRenders} from 'reassure';

import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';

const ROW_COUNT = 50;
const ATTENDEES_PER_ROW = 3;
const WRITES_PER_SCENARIO = 10;
const LARGE_PERSONAL_DETAILS_COUNT = 5000;
const UNRELATED_ACCOUNT_ID = 1000;
const SHARED_ATTENDEE_ACCOUNT_ID = 2000;
const SHARED_ATTENDEE_DUPLICATE_ACCOUNT_ID = 2001;
const FIRST_EXTRA_ACCOUNT_ID = 10000;
const SHARED_ATTENDEE_EMAIL = 'shared@test.com';

const smallPersonalDetails: PersonalDetailsList = {
    [UNRELATED_ACCOUNT_ID]: {accountID: UNRELATED_ACCOUNT_ID, login: 'unrelated@test.com', displayName: 'Unrelated'},
    [SHARED_ATTENDEE_ACCOUNT_ID]: {accountID: SHARED_ATTENDEE_ACCOUNT_ID, login: SHARED_ATTENDEE_EMAIL, displayName: 'Shared'},
    [SHARED_ATTENDEE_DUPLICATE_ACCOUNT_ID]: {accountID: SHARED_ATTENDEE_DUPLICATE_ACCOUNT_ID, login: SHARED_ATTENDEE_EMAIL, displayName: 'Shared duplicate'},
};
const rows: Attendee[][] = [];
for (let row = 0; row < ROW_COUNT; row++) {
    const attendees: Attendee[] = [{email: SHARED_ATTENDEE_EMAIL, displayName: 'Shared', avatarUrl: ''}];
    for (let index = 0; index < ATTENDEES_PER_ROW; index++) {
        const accountID = row * ATTENDEES_PER_ROW + index + 1;
        const email = `attendee${accountID}@test.com`;
        smallPersonalDetails[accountID] = {accountID, login: email, displayName: `Attendee ${accountID}`};
        attendees.push({email, displayName: `Attendee ${accountID}`, avatarUrl: ''});
    }
    rows.push(attendees);
}

const largePersonalDetails: PersonalDetailsList = {
    ...smallPersonalDetails,
    ...Object.fromEntries(
        Array.from({length: LARGE_PERSONAL_DETAILS_COUNT}, (value, index) => {
            const accountID = FIRST_EXTRA_ACCOUNT_ID + index;
            return [accountID, {accountID, login: `user${accountID}@test.com`, displayName: `User ${accountID}`}];
        }),
    ),
};

/** Passed as the reassure wrapper so the providers sit outside the profiler and render counts are the rows' own */
function Providers({children}: {children: React.ReactNode}) {
    return <ComposeProviders components={[OnyxListItemProvider, LocaleContextProvider]}>{children}</ComposeProviders>;
}

/** Search rows read the login map but not the report attributes, so their re-renders isolate login map churn */
function SearchRowsWithAttendees() {
    return (
        <View>
            {rows.map((attendees, index) => (
                <AttendeesCell
                    // eslint-disable-next-line react/no-array-index-key
                    key={index}
                    attendees={attendees}
                    isHovered={false}
                    isPressed={false}
                />
            ))}
        </View>
    );
}

async function seed(personalDetails: PersonalDetailsList) {
    await Onyx.set(ONYXKEYS.PERSONAL_DETAILS_LIST, personalDetails);
    await waitForBatchedUpdates();
}

async function renameUnrelatedUser(label: string) {
    for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
        await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {[UNRELATED_ACCOUNT_ID]: {displayName: `Unrelated ${label}-${index}`}});
        await waitForBatchedUpdates();
    }
}

describe('Login to accountID map consumers on personal details writes', () => {
    beforeAll(async () => {
        Onyx.init({keys: ONYXKEYS});
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        require('@userActions/OnyxDerived').default();
        await waitForBatchedUpdates();
    });

    afterEach(async () => {
        await Onyx.clear();
        await waitForBatchedUpdates();
    });

    test('[LoginToAccountIDMap] should re-render 50 Search rows when a user who attends nothing is renamed', async () => {
        // Given 50 Search rows with attendees
        await seed(smallPersonalDetails);

        // Reassure runs the scenario several times against one seeded Onyx, so every run writes a name that doesn't exist yet
        let run = 0;
        const scenario = async () => {
            await screen.findAllByTestId('AttendeesCell-Row');

            // When a user who attends none of them is renamed, which leaves every login's accountID unchanged
            await renameUnrelatedUser(`small ${run}`);
            run++;
        };

        // Then reassure measures how many row re-renders the unrelated writes cause
        await measureRenders(<SearchRowsWithAttendees />, {scenario, wrapper: Providers});
    });

    test('[LoginToAccountIDMap] should re-render 50 Search rows when the account behind a shared attendee changes', async () => {
        // Given 50 Search rows that all list one attendee whose login belongs to two accounts
        await seed(smallPersonalDetails);

        let isFirstAccountClosed = false;
        const scenario = async () => {
            await screen.findAllByTestId('AttendeesCell-Row');

            // When the first account is closed and reopened in turn, so the login resolves to the other account and back
            for (let index = 0; index < WRITES_PER_SCENARIO; index++) {
                isFirstAccountClosed = !isFirstAccountClosed;
                await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {[SHARED_ATTENDEE_ACCOUNT_ID]: {isClosed: isFirstAccountClosed}});
                await waitForBatchedUpdates();
            }
        };

        // Then reassure measures the cost of a real change, which both versions have to pay
        await measureRenders(<SearchRowsWithAttendees />, {scenario, wrapper: Providers});
    });

    test('[LoginToAccountIDMap] should re-render 50 Search rows when a user who attends nothing is renamed in a large personal details list', async () => {
        // Given the same rows, with 5000 more people in the personal details list
        await seed(largePersonalDetails);

        let run = 0;
        const scenario = async () => {
            await screen.findAllByTestId('AttendeesCell-Row');

            // When a user who attends nothing is renamed, so every write rebuilds the whole login map
            await renameUnrelatedUser(`large ${run}`);
            run++;
        };

        // Then reassure measures the render cost, which grows if each row rebuilds the map during render
        await measureRenders(<SearchRowsWithAttendees />, {scenario, wrapper: Providers});
    });

    test('[LoginToAccountIDMap] should process renames of a user who attends nothing in a large personal details list', async () => {
        // Given the rows mounted over the large personal details list
        await seed(largePersonalDetails);
        render(
            <Providers>
                <SearchRowsWithAttendees />
            </Providers>,
        );
        await screen.findAllByTestId('AttendeesCell-Row');

        // When a user who attends nothing is renamed repeatedly
        let run = 0;
        const writeRenames = async () => {
            await renameUnrelatedUser(`timed ${run}`);
            run++;
        };

        // Then reassure times the whole write loop, including work done outside React renders such as derived computes and their writes
        await measureAsyncFunction(writeRenames);
    });
});
