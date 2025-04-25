/* eslint-disable @typescript-eslint/naming-convention */
import type {OnyxCollection} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import DateUtils from '@libs/DateUtils';
import type {OptionList, Options} from '@libs/OptionsListUtils';
import {createOptionList, getValidOptions, orderOptions} from '@libs/OptionsListUtils';
import type {OptionData} from '@libs/ReportUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {PersonalDetails, Policy, Report} from '@src/types/onyx';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';

jest.mock('@rnmapbox/maps', () => {
    return {
        default: jest.fn(),
        MarkerView: jest.fn(),
        setAccessToken: jest.fn(),
    };
});

jest.mock('@react-native-community/geolocation', () => ({
    setRNConfiguration: jest.fn(),
}));

type PersonalDetailsList = Record<string, PersonalDetails & OptionData>;

describe('OptionsListUtils', () => {
    const policyID = 'ABC123';

    const POLICY: Policy = {
        id: policyID,
        name: 'Hero Policy',
        role: 'user',
        type: CONST.POLICY.TYPE.TEAM,
        owner: 'reedrichards@expensify.com',
        outputCurrency: '',
        isPolicyExpenseChatEnabled: false,
        approvalMode: CONST.POLICY.APPROVAL_MODE.OPTIONAL,
    };

    // Given a set of reports with both single participants and multiple participants some pinned and some not
    const REPORTS: OnyxCollection<Report> = {
        '1': {
            lastReadTime: '2021-01-14 11:25:39.295',
            lastVisibleActionCreated: '2022-11-22 03:26:02.015',
            isPinned: false,
            reportID: '1',
            participants: {
                2: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
                1: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
                5: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
            },
            reportName: 'Iron Man, Mister Fantastic, Invisible Woman',
            type: CONST.REPORT.TYPE.CHAT,
        },
        '2': {
            lastReadTime: '2021-01-14 11:25:39.296',
            lastVisibleActionCreated: '2022-11-22 03:26:02.016',
            isPinned: false,
            reportID: '2',
            participants: {
                2: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
                3: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
            },
            reportName: 'Spider-Man',
            type: CONST.REPORT.TYPE.CHAT,
        },

        // This is the only report we are pinning in this test
        '3': {
            lastReadTime: '2021-01-14 11:25:39.297',
            lastVisibleActionCreated: '2022-11-22 03:26:02.170',
            isPinned: true,
            reportID: '3',
            participants: {
                2: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
                1: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
            },
            reportName: 'Mister Fantastic',
            type: CONST.REPORT.TYPE.CHAT,
        },
        '4': {
            lastReadTime: '2021-01-14 11:25:39.298',
            lastVisibleActionCreated: '2022-11-22 03:26:02.180',
            isPinned: false,
            reportID: '4',
            participants: {
                2: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
                4: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
            },
            reportName: 'Black Panther',
            type: CONST.REPORT.TYPE.CHAT,
        },
        '5': {
            lastReadTime: '2021-01-14 11:25:39.299',
            lastVisibleActionCreated: '2022-11-22 03:26:02.019',
            isPinned: false,
            reportID: '5',
            participants: {
                2: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
                5: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
            },
            reportName: 'Invisible Woman',
            type: CONST.REPORT.TYPE.CHAT,
        },
        '6': {
            lastReadTime: '2021-01-14 11:25:39.300',
            lastVisibleActionCreated: '2022-11-22 03:26:02.020',
            isPinned: false,
            reportID: '6',
            participants: {
                2: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
                6: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
            },
            reportName: 'Thor',
            type: CONST.REPORT.TYPE.CHAT,
        },

        // Note: This report has the largest lastVisibleActionCreated
        '7': {
            lastReadTime: '2021-01-14 11:25:39.301',
            lastVisibleActionCreated: '2022-11-22 03:26:03.999',
            isPinned: false,
            reportID: '7',
            participants: {
                2: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
                7: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
            },
            reportName: 'Captain America',
            type: CONST.REPORT.TYPE.CHAT,
        },

        // Note: This report has no lastVisibleActionCreated
        '8': {
            lastReadTime: '2021-01-14 11:25:39.301',
            lastVisibleActionCreated: '2022-11-22 03:26:02.000',
            isPinned: false,
            reportID: '8',
            participants: {
                2: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
                12: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
            },
            reportName: 'Silver Surfer',
            type: CONST.REPORT.TYPE.CHAT,
        },

        // Note: This report has an IOU
        '9': {
            lastReadTime: '2021-01-14 11:25:39.302',
            lastVisibleActionCreated: '2022-11-22 03:26:02.998',
            isPinned: false,
            reportID: '9',
            participants: {
                2: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
                8: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
            },
            reportName: 'Mister Sinister',
            iouReportID: '100',
            type: CONST.REPORT.TYPE.CHAT,
        },

        // This report is an archived room – it does not have a name and instead falls back on oldPolicyName
        '10': {
            lastReadTime: '2021-01-14 11:25:39.200',
            lastVisibleActionCreated: '2022-11-22 03:26:02.001',
            reportID: '10',
            isPinned: false,
            participants: {
                2: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
                7: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
            },
            reportName: '',
            oldPolicyName: "SHIELD's workspace",
            chatType: CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT,
            isOwnPolicyExpenseChat: true,
            type: CONST.REPORT.TYPE.CHAT,
            lastActorAccountID: 2,
        },
        '11': {
            lastReadTime: '2021-01-14 11:25:39.200',
            lastVisibleActionCreated: '2022-11-22 03:26:02.001',
            reportID: '11',
            isPinned: false,
            participants: {
                10: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN},
            },
            reportName: '',
            chatType: CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT,
            isOwnPolicyExpenseChat: true,
            type: CONST.REPORT.TYPE.CHAT,
            policyID,
            policyName: POLICY.name,
        },

        // Thread report with notification preference = hidden
        '12': {
            lastReadTime: '2021-01-14 11:25:39.200',
            lastVisibleActionCreated: '2022-11-22 03:26:02.001',
            reportID: '11',
            isPinned: false,
            participants: {
                10: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN},
            },
            reportName: '',
            chatType: CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT,
            isOwnPolicyExpenseChat: true,
            type: CONST.REPORT.TYPE.CHAT,
            policyID,
            policyName: POLICY.name,
            parentReportActionID: '123',
            parentReportID: '123',
        },
    };

    const activePolicyID = 'DEF456';

    // And a set of personalDetails some with existing reports and some without
    const PERSONAL_DETAILS: PersonalDetailsList = {
        // These exist in our reports
        '1': {
            accountID: 1,
            displayName: 'Mister Fantastic',
            login: 'reedrichards@expensify.com',
            isSelected: true,
            reportID: '1',
        },
        '2': {
            accountID: 2,
            displayName: 'Iron Man',
            login: 'tonystark@expensify.com',
            reportID: '1',
        },
        '3': {
            accountID: 3,
            displayName: 'Spider-Man',
            login: 'peterparker@expensify.com',
            reportID: '1',
        },
        '4': {
            accountID: 4,
            displayName: 'Black Panther',
            login: 'tchalla@expensify.com',
            reportID: '1',
        },
        '5': {
            accountID: 5,
            displayName: 'Invisible Woman',
            login: 'suestorm@expensify.com',
            reportID: '1',
        },
        '6': {
            accountID: 6,
            displayName: 'Thor',
            login: 'thor@expensify.com',
            reportID: '1',
        },
        '7': {
            accountID: 7,
            displayName: 'Captain America',
            login: 'steverogers@expensify.com',
            reportID: '1',
        },
        '8': {
            accountID: 8,
            displayName: 'Mr Sinister',
            login: 'mistersinister@marauders.com',
            reportID: '1',
        },

        // These do not exist in reports at all
        '9': {
            accountID: 9,
            displayName: 'Black Widow',
            login: 'natasharomanoff@expensify.com',
            reportID: '',
        },
        '10': {
            accountID: 10,
            displayName: 'The Incredible Hulk',
            login: 'brucebanner@expensify.com',
            reportID: '',
        },
    };

    const PERSONAL_DETAILS_WITH_CONCIERGE: PersonalDetailsList = {
        ...PERSONAL_DETAILS,
        '999': {
            accountID: 999,
            displayName: 'Concierge',
            login: 'concierge@expensify.com',
            reportID: '',
        },
    };

    const PERSONAL_DETAILS_WITH_CHRONOS: PersonalDetailsList = {
        ...PERSONAL_DETAILS,

        '1000': {
            accountID: 1000,
            displayName: 'Chronos',
            login: 'chronos@expensify.com',
            reportID: '',
        },
    };

    const PERSONAL_DETAILS_WITH_RECEIPTS: PersonalDetailsList = {
        ...PERSONAL_DETAILS,

        '1001': {
            accountID: 1001,
            displayName: 'Receipts',
            login: 'receipts@expensify.com',
            reportID: '',
        },
    };

    const PERSONAL_DETAILS_WITH_MANAGER_MCTEST: PersonalDetailsList = {
        ...PERSONAL_DETAILS,
        '1003': {
            accountID: 1003,
            displayName: 'Manager McTest',
            login: CONST.EMAIL.MANAGER_MCTEST,
            reportID: '',
        },
    };

    const REPORTS_WITH_CONCIERGE: OnyxCollection<Report> = {
        ...REPORTS,

        '11': {
            lastReadTime: '2021-01-14 11:25:39.302',
            lastVisibleActionCreated: '2022-11-22 03:26:02.022',
            isPinned: false,
            reportID: '11',
            participants: {
                2: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
                999: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
            },
            reportName: 'Concierge',
            type: CONST.REPORT.TYPE.CHAT,
        },
    };

    const REPORTS_WITH_CHRONOS: OnyxCollection<Report> = {
        ...REPORTS,
        '12': {
            lastReadTime: '2021-01-14 11:25:39.302',
            lastVisibleActionCreated: '2022-11-22 03:26:02.022',
            isPinned: false,
            reportID: '12',
            participants: {
                2: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
                1000: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
            },
            reportName: 'Chronos',
            type: CONST.REPORT.TYPE.CHAT,
        },
    };

    const REPORTS_WITH_RECEIPTS: OnyxCollection<Report> = {
        ...REPORTS,
        '13': {
            lastReadTime: '2021-01-14 11:25:39.302',
            lastVisibleActionCreated: '2022-11-22 03:26:02.022',
            isPinned: false,
            reportID: '13',
            participants: {
                2: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
                1001: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
            },
            reportName: 'Receipts',
            type: CONST.REPORT.TYPE.CHAT,
        },
    };

    const REPORTS_WITH_WORKSPACE_ROOMS: OnyxCollection<Report> = {
        ...REPORTS,
        '14': {
            lastReadTime: '2021-01-14 11:25:39.302',
            lastVisibleActionCreated: '2022-11-22 03:26:02.022',
            isPinned: false,
            reportID: '14',
            participants: {
                2: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
                1: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
                10: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
                3: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS},
            },
            reportName: '',
            oldPolicyName: 'Avengers Room',
            chatType: CONST.REPORT.CHAT_TYPE.POLICY_ADMINS,
            isOwnPolicyExpenseChat: true,
            type: CONST.REPORT.TYPE.CHAT,
        },
        18: {
            lastReadTime: '2021-01-14 11:25:39.302',
            lastVisibleActionCreated: '2022-11-22 03:26:02.022',
            isPinned: false,
            reportID: '18',
            participants: {
                2: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN},
                1: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN},
                10: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN},
                3: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN},
            },
            reportName: '',
            oldPolicyName: 'Justice League Room',
            chatType: CONST.REPORT.CHAT_TYPE.POLICY_ROOM,
            isOwnPolicyExpenseChat: true,
            type: CONST.REPORT.TYPE.CHAT,
        },
    };

    const reportNameValuePairs = {
        private_isArchived: DateUtils.getDBTime(),
    };

    // Set the currently logged in user, report data, and personal details
    beforeAll(() => {
        Onyx.init({
            keys: ONYXKEYS,
            initialKeyStates: {
                [ONYXKEYS.SESSION]: {accountID: 2, email: 'tonystark@expensify.com'},
                [`${ONYXKEYS.COLLECTION.REPORT}100` as const]: {
                    reportID: '',
                    ownerAccountID: 8,
                    total: 1000,
                },
                [`${ONYXKEYS.COLLECTION.POLICY}${policyID}` as const]: POLICY,
                [ONYXKEYS.NVP_ACTIVE_POLICY_ID]: activePolicyID,
                [ONYXKEYS.NVP_DISMISSED_PRODUCT_TRAINING]: {},
            },
        });
        Onyx.registerLogger(() => {});
        return waitForBatchedUpdates().then(() => Onyx.set(ONYXKEYS.PERSONAL_DETAILS_LIST, PERSONAL_DETAILS));
    });

    let OPTIONS: OptionList;
    let OPTIONS_WITH_CONCIERGE: OptionList;
    let OPTIONS_WITH_CHRONOS: OptionList;
    let OPTIONS_WITH_RECEIPTS: OptionList;
    let OPTIONS_WITH_WORKSPACE_ROOM: OptionList;
    let OPTIONS_WITH_MANAGER_MCTEST: OptionList;

    beforeEach(() => {
        Onyx.set(`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}10`, reportNameValuePairs);
        OPTIONS = createOptionList(PERSONAL_DETAILS, REPORTS);
        OPTIONS_WITH_CONCIERGE = createOptionList(PERSONAL_DETAILS_WITH_CONCIERGE, REPORTS_WITH_CONCIERGE);
        OPTIONS_WITH_CHRONOS = createOptionList(PERSONAL_DETAILS_WITH_CHRONOS, REPORTS_WITH_CHRONOS);
        OPTIONS_WITH_RECEIPTS = createOptionList(PERSONAL_DETAILS_WITH_RECEIPTS, REPORTS_WITH_RECEIPTS);
        OPTIONS_WITH_WORKSPACE_ROOM = createOptionList(PERSONAL_DETAILS, REPORTS_WITH_WORKSPACE_ROOMS);
        OPTIONS_WITH_MANAGER_MCTEST = createOptionList(PERSONAL_DETAILS_WITH_MANAGER_MCTEST);
    });

    describe('orderOptions()', () => {
        it('should sort all options correctly', () => {
            // When we call getValidOptions() with no search value
            let results: Pick<Options, 'personalDetails' | 'recentReports'> = getValidOptions({
                reports: OPTIONS.reports,
                personalDetails: OPTIONS.personalDetails,
            });
            results = orderOptions(results);

            // We should expect all personalDetails except the currently logged in user to be returned
            // Filtering of personalDetails that have reports is done in filterOptions
            expect(results.personalDetails.length).toBe(Object.values(OPTIONS.personalDetails).length - 1);

            // All personal details including those that have reports should be returned
            // We should expect personal details sorted alphabetically
            const expected = ['Black Panther', 'Black Widow', 'Captain America', 'Invisible Woman', 'Mister Fantastic', 'Mr Sinister', 'Spider-Man', 'The Incredible Hulk', 'Thor'];
            const actual = results.personalDetails?.map((item) => item.text);

            expect(actual).toEqual(expected);

            // Then the result which has an existing report should also have the reportID attached
            const personalDetailWithExistingReport = results.personalDetails.find((personalDetail) => personalDetail.login === 'peterparker@expensify.com');
            expect(personalDetailWithExistingReport?.reportID).toBe('2');
        });

        it('should sort all options correctly with no reports', () => {
            let results: Pick<Options, 'personalDetails' | 'recentReports'> = getValidOptions({personalDetails: OPTIONS.personalDetails, reports: []});
            results = orderOptions(results);

            const expected = ['Black Panther', 'Black Widow', 'Captain America', 'Invisible Woman', 'Mister Fantastic', 'Mr Sinister', 'Spider-Man', 'The Incredible Hulk', 'Thor'];
            const actual = results.personalDetails?.map((item) => item.text);

            expect(actual).toEqual(expected);
        });
    });

    describe('getValidOptions()', () => {
        it('should correctly filter when there are no reports or personalDetails', () => {
            // Given empty arrays for reports and personalDetails
            // When we call getValidOptions()
            const results = getValidOptions({reports: [], personalDetails: []});

            // Then the result should be empty
            expect(results.personalDetails).toEqual([]);
            expect(results.recentReports).toEqual([]);
            expect(results.currentUserOption).toBeUndefined();
            expect(results.userToInvite).toEqual(null);
            expect(results.workspaceChats).toEqual([]);
            expect(results.selfDMChat).toEqual(undefined);
        });

        it('should include Concierge in results', () => {
            // Given a set of reports and personalDetails that includes Concierge
            // When we call getValidOptions()
            const results = getValidOptions({reports: OPTIONS_WITH_CONCIERGE.reports, personalDetails: OPTIONS_WITH_CONCIERGE.personalDetails});

            // Then the result should include all personalDetails except the currently logged in user
            expect(results.personalDetails.length).toBe(Object.values(OPTIONS_WITH_CONCIERGE.personalDetails).length - 1);
            // Then the result should include Concierge
            expect(results.recentReports).toEqual(expect.arrayContaining([expect.objectContaining({login: 'concierge@expensify.com'})]));
        });

        it('should exclude concierge from results', () => {
            // Given a set of reports and personalDetails that includes Concierge and a config object that excludes Concierge
            // When we call getValidOptions()
            const results = getValidOptions(
                {
                    reports: OPTIONS_WITH_CONCIERGE.reports,
                    personalDetails: OPTIONS_WITH_CONCIERGE.personalDetails,
                },
                {
                    excludeLogins: {[CONST.EMAIL.CONCIERGE]: true},
                },
            );

            // Then the result should include all personalDetails except the currently logged in user and Concierge
            expect(results.personalDetails.length).toBe(Object.values(OPTIONS_WITH_CONCIERGE.personalDetails).length - 2);
            // Then the result should not include Concierge
            expect(results.personalDetails).not.toEqual(expect.arrayContaining([expect.objectContaining({login: 'concierge@expensify.com'})]));
        });

        it('should exclude Chronos from results', () => {
            // Given a set of reports and personalDetails that includes Chronos and a config object that excludes Chronos
            // When we call getValidOptions()
            const results = getValidOptions({reports: OPTIONS_WITH_CHRONOS.reports, personalDetails: OPTIONS_WITH_CHRONOS.personalDetails}, {excludeLogins: {[CONST.EMAIL.CHRONOS]: true}});

            // Then the result should include all personalDetails except the currently logged in user and Chronos
            expect(results.personalDetails.length).toBe(Object.values(OPTIONS_WITH_CHRONOS.personalDetails).length - 2);
            // Then the result should not include Chronos
            expect(results.personalDetails).not.toEqual(expect.arrayContaining([expect.objectContaining({login: 'chronos@expensify.com'})]));
        });

        it('should exclude receipts from results', () => {
            // Given a set of reports and personalDetails that includes receipts and a config object that excludes receipts
            // When we call getValidOptions()
            const results = getValidOptions(
                {
                    reports: OPTIONS_WITH_RECEIPTS.reports,
                    personalDetails: OPTIONS_WITH_RECEIPTS.personalDetails,
                },
                {
                    excludeLogins: {[CONST.EMAIL.RECEIPTS]: true},
                },
            );

            // Then the result should include all personalDetails except the currently logged in user and receipts
            expect(results.personalDetails.length).toBe(Object.values(OPTIONS_WITH_RECEIPTS.personalDetails).length - 2);
            // Then the result should not include receipts
            expect(results.personalDetails).not.toEqual(expect.arrayContaining([expect.objectContaining({login: 'receipts@expensify.com'})]));
        });

        it('should include Manager McTest in results', () => {
            // Given a set of reports and personalDetails that includes Manager McTest
            // When we call getValidOptions()
            const result = getValidOptions(
                {reports: OPTIONS_WITH_MANAGER_MCTEST.reports, personalDetails: OPTIONS_WITH_MANAGER_MCTEST.personalDetails},
                {includeP2P: true, canShowManagerMcTest: true, betas: [CONST.BETAS.NEWDOT_MANAGER_MCTEST]},
            );

            // Then the result should include all personalDetails except the currently logged in user
            expect(result.personalDetails.length).toBe(Object.values(OPTIONS_WITH_MANAGER_MCTEST.personalDetails).length - 1);
            // Then the result should include Manager McTest
            expect(result.personalDetails).toEqual(expect.arrayContaining([expect.objectContaining({login: CONST.EMAIL.MANAGER_MCTEST})]));
        });

        it('should exclude Manager McTest from results if flag is set to false', () => {
            // Given a set of reports and personalDetails that includes Manager McTest and a config object that excludes Manager McTest
            // When we call getValidOptions()
            const result = getValidOptions(
                {reports: OPTIONS_WITH_MANAGER_MCTEST.reports, personalDetails: OPTIONS_WITH_MANAGER_MCTEST.personalDetails},
                {includeP2P: true, canShowManagerMcTest: false, betas: [CONST.BETAS.NEWDOT_MANAGER_MCTEST]},
            );

            // Then the result should include all personalDetails except the currently logged in user and Manager McTest
            expect(result.personalDetails.length).toBe(Object.values(OPTIONS_WITH_MANAGER_MCTEST.personalDetails).length - 2);
            // Then the result should not include Manager McTest
            expect(result.personalDetails).not.toEqual(expect.arrayContaining([expect.objectContaining({login: CONST.EMAIL.MANAGER_MCTEST})]));
        });

        it('should exclude Manager McTest from results if user dismissed the tooltip', () => {
            return waitForBatchedUpdates()
                .then(() =>
                    // Given that the user has dismissed the tooltip
                    Onyx.set(ONYXKEYS.NVP_DISMISSED_PRODUCT_TRAINING, {
                        [CONST.PRODUCT_TRAINING_TOOLTIP_NAMES.SCAN_TEST_TOOLTIP]: {
                            timestamp: DateUtils.getDBTime(new Date().valueOf()),
                        },
                    }),
                )
                .then(() => {
                    // When we call getValidOptions()
                    const optionsWhenUserAlreadySubmittedExpense = getValidOptions(
                        {reports: OPTIONS_WITH_MANAGER_MCTEST.reports, personalDetails: OPTIONS_WITH_MANAGER_MCTEST.personalDetails},
                        {includeP2P: true, canShowManagerMcTest: true, betas: [CONST.BETAS.NEWDOT_MANAGER_MCTEST]},
                    );

                    // Then the result should include all personalDetails except the currently logged in user and Manager McTest
                    expect(optionsWhenUserAlreadySubmittedExpense.personalDetails.length).toBe(Object.values(OPTIONS_WITH_MANAGER_MCTEST.personalDetails).length - 2);
                    // Then the result should not include Manager McTest
                    expect(optionsWhenUserAlreadySubmittedExpense.personalDetails).not.toEqual(expect.arrayContaining([expect.objectContaining({login: CONST.EMAIL.MANAGER_MCTEST})]));
                });
        });
    });

    describe('getValidOptions() for chat room', () => {
        it('should include all reports', () => {
            // Given a set of reports and personalDetails that includes workspace rooms with no `excludeHiddenChatRoom` flag
            // When we call getValidOptions()
            const results = getValidOptions(OPTIONS_WITH_WORKSPACE_ROOM, {
                includeRecentReports: true,
                includeMultipleParticipantReports: true,
                includeP2P: true,
                includeOwnedWorkspaceChats: true,
            });

            // Then the result should include all reports except the currently logged in user
            expect(results.recentReports.length).toBe(OPTIONS_WITH_WORKSPACE_ROOM.reports.length - 1);
            expect(results.recentReports).toEqual(expect.arrayContaining([expect.objectContaining({reportID: '14'})]));
            expect(results.recentReports).toEqual(expect.arrayContaining([expect.objectContaining({reportID: '18'})]));
        });

        it('should exclude hidden chat room', () => {
            // Given a set of reports and personalDetails that includes workspace rooms with `excludeHiddenChatRoom` flag
            // When we call getValidOptions()
            const results = getValidOptions(OPTIONS_WITH_WORKSPACE_ROOM, {
                includeRecentReports: true,
                includeMultipleParticipantReports: true,
                includeP2P: true,
                includeOwnedWorkspaceChats: true,
                excludeHiddenChatRoom: true,
            });

            // Then the result should include all reports except the currently logged in user and hidden chat room
            expect(results.recentReports.length).toBe(OPTIONS_WITH_WORKSPACE_ROOM.reports.length - 2);
            expect(results.recentReports).toEqual(expect.arrayContaining([expect.objectContaining({reportID: '14'})]));
            expect(results.recentReports).not.toEqual(expect.arrayContaining([expect.objectContaining({reportID: '18'})]));
        });
    });
});
