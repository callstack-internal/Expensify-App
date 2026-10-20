import crypto from 'node:crypto';

type Account = {authToken: string; accountID: number; email: string};

type ApiResponse = {jsonCode: number; authToken?: string; email?: string; userMetadata?: {accountID: number}};

// Throwaway accounts on the staging backend, which signs up a new email without a magic code.
const API_ROOT = 'https://staging.expensify.com/api/';

const generateID = () => (crypto.randomInt(2 ** 21) * 2 ** 32 + crypto.randomInt(2 ** 32)).toString();
const generateHex = (length: number) => crypto.randomBytes(length).toString('hex').toUpperCase().slice(0, length);
const today = () => new Date().toISOString().slice(0, 10);
const UNREPORTED_REPORT_ID = '0';

function isApiResponse(value: unknown): value is ApiResponse {
    return typeof value === 'object' && value !== null && 'jsonCode' in value;
}

async function callAPI(command: string, params: Record<string, unknown>, account?: Account): Promise<ApiResponse> {
    const body = new FormData();
    const allParams = {...params, referer: 'ecash', platform: 'web', ...(account && {authToken: account.authToken, email: account.email})};
    for (const [key, value] of Object.entries(allParams)) {
        body.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
    // Keeps the API from setting the cookie that Expensify Classic authenticates with.
    body.append('api_setCookie', 'false');
    const response = await fetch(`${API_ROOT}${command}?`, {method: 'POST', body});
    const json: unknown = await response.json();
    if (!isApiResponse(json) || json.jsonCode !== 200) {
        throw new Error(`${command} failed: ${JSON.stringify(json).slice(0, 500)}`);
    }
    return json;
}

async function signUp(): Promise<Account> {
    const email = `e2e+${Date.now()}${crypto.randomInt(1000)}@e2etestdomain.com`;
    const response = await callAPI('SignUpUser', {email, preferredLocale: 'en', deviceInfo: '{}'});
    if (!response.authToken || !response.userMetadata) {
        throw new Error('SignUpUser returned no session');
    }
    const account = {authToken: response.authToken, accountID: response.userMetadata.accountID, email};
    await callAPI('SetNameValuePair', {name: 'nvp_onboarding', value: {hasCompletedGuidedSetupFlow: true}}, account);
    return account;
}

type ExpenseParams = {
    chatReportID: string;
    iouReportID: string;
    amount: number;
    merchant: string;
    currency?: string;
    taxCode?: string;
    taxAmount?: number;
    isNewReport?: boolean;
    debtor?: Account;
};

async function requestMoney(owner: Account, {chatReportID, iouReportID, amount, merchant, currency = 'USD', taxCode = '', taxAmount = 0, isNewReport = false, debtor}: ExpenseParams) {
    const transactionID = generateID();
    await callAPI(
        'RequestMoney',
        {
            // A workspace expense has no debtor; the backend bills the workspace.
            ...(debtor ? {debtorEmail: debtor.email, debtorAccountID: debtor.accountID} : {debtorEmail: '', debtorAccountID: 0}),
            amount,
            currency,
            comment: '',
            created: today(),
            merchant,
            iouReportID,
            chatReportID,
            transactionID,
            reportActionID: generateID(),
            ...(isNewReport && {createdIOUReportActionID: generateID()}),
            reportPreviewReportActionID: generateID(),
            taxCode,
            taxAmount,
            transactionThreadReportID: generateID(),
            createdReportActionIDForThread: generateID(),
            reimbursable: true,
        },
        owner,
    );
    return transactionID;
}

// The move's system message; moving into a draft report would create none and omit movedReportActionID.
function moveExpense(owner: Account, transactionID: string, reportID: string) {
    const threadData = {
        movedReportActionID: generateID(),
        moneyRequestPreviewReportActionID: generateID(),
        ...(reportID === UNREPORTED_REPORT_ID && {selfDMReportID: generateID(), selfDMCreatedReportActionID: generateID()}),
    };
    return callAPI('ChangeTransactionsReport', {transactionList: transactionID, reportID, transactionIDToReportActionAndThreadData: {[transactionID]: threadData}}, owner);
}

async function createReport(owner: Account, policyID: string, reportName: string) {
    const reportID = generateID();
    await callAPI(
        'CreateAppReport',
        {policyID, type: 'expense', reportID, reportActionID: generateID(), reportPreviewReportActionID: generateID(), reportName, shouldDismissEmptyReportsConfirmation: true},
        owner,
    );
    return reportID;
}

async function createWorkspace(owner: Account, policyName: string, type: 'submit2026' | 'team') {
    const policyID = generateHex(16);
    const expenseChatReportID = generateID();
    await callAPI(
        'CreateWorkspace',
        {
            policyID,
            adminsChatReportID: generateID(),
            expenseChatReportID,
            ownerEmail: '',
            makeMeAdmin: true,
            policyName,
            type,
            adminsCreatedReportActionID: generateID(),
            expenseCreatedReportActionID: generateID(),
            customUnitID: generateHex(13),
            customUnitRateID: generateHex(13),
            currency: 'USD',
            ...(type === 'submit2026' && {engagementChoice: 'newDotEmployer'}),
        },
        owner,
    );
    return {policyID, expenseChatReportID};
}

/**
 * Signs up a fresh account that already has:
 * - "E2E Submit Workspace", a Submit workspace like the one "Submit to my employer" onboarding creates
 * - report "Fixture A" with one expense and report "Fixture B" with two, both drafts in that workspace
 * - report "Fixture C", submitted, with "Fixture C Lunch", "Fixture C Taxi" and "Fixture C Hotel", which was moved in from "Fixture D" afterwards
 * - report "Fixture D", a draft with "Fixture D Parking" left after "Fixture C Hotel" moved out and "Fixture Loose" was removed from it
 * - "Fixture Loose", an unreported expense in the self DM
 * - "E2E Collect Workspace", a Collect workspace with taxes on and the default rates (Tax exempt 0%, Tax Rate 1 5%), and draft report "Fixture Tax" with "Fixture Tax Pos" ($20, Tax Rate 1), "Fixture Tax Neg" (-$20, Tax Rate 1), "Fixture Tax EUR" (-€20, Tax Rate 1) and "Fixture Tax Exempt" (-$10, Tax exempt)
 * - a 1:1 chat with a second fresh account holding a paid "Fixture Pay" payment and an outstanding "Fixture Request" money request
 */
async function createSeededAccount(): Promise<Account> {
    const [owner, payee] = await Promise.all([signUp(), signUp()]);

    const {policyID, expenseChatReportID} = await createWorkspace(owner, 'E2E Submit Workspace', 'submit2026');

    // A Submit workspace files every new expense into its one open report, so the reports are created first.
    const reportA = await createReport(owner, policyID, 'Fixture A');
    await requestMoney(owner, {chatReportID: expenseChatReportID, iouReportID: reportA, amount: 1200, merchant: 'Fixture A Cafe'});
    const reportB = await createReport(owner, policyID, 'Fixture B');
    await requestMoney(owner, {chatReportID: expenseChatReportID, iouReportID: reportB, amount: 500, merchant: 'Fixture B Shop'});
    await requestMoney(owner, {chatReportID: expenseChatReportID, iouReportID: reportB, amount: 900, merchant: 'Fixture B Bakery'});

    const reportC = await createReport(owner, policyID, 'Fixture C');
    await requestMoney(owner, {chatReportID: expenseChatReportID, iouReportID: reportC, amount: 1500, merchant: 'Fixture C Lunch'});
    await requestMoney(owner, {chatReportID: expenseChatReportID, iouReportID: reportC, amount: 2200, merchant: 'Fixture C Taxi'});
    const reportD = await createReport(owner, policyID, 'Fixture D');
    await requestMoney(owner, {chatReportID: expenseChatReportID, iouReportID: reportD, amount: 600, merchant: 'Fixture D Parking'});
    const hotel = await requestMoney(owner, {chatReportID: expenseChatReportID, iouReportID: reportD, amount: 8000, merchant: 'Fixture C Hotel'});
    const loose = await requestMoney(owner, {chatReportID: expenseChatReportID, iouReportID: reportD, amount: 400, merchant: 'Fixture Loose'});
    // The owner approves their own reports on a Submit workspace.
    await callAPI('SubmitReport', {reportID: reportC, reportActionID: generateID(), managerAccountID: owner.accountID, managerEmail: owner.email}, owner);
    await moveExpense(owner, hotel, reportC);
    await moveExpense(owner, loose, UNREPORTED_REPORT_ID);

    const collect = await createWorkspace(owner, 'E2E Collect Workspace', 'team');
    await callAPI(
        'EnablePolicyTaxes',
        {
            policyID: collect.policyID,
            enabled: true,
            taxFields: {
                defaultExternalID: 'id_TAX_EXEMPT',
                defaultValue: '0%',
                foreignTaxDefault: 'id_TAX_EXEMPT',
                name: 'Tax',
                // The backend's tax rate IDs, which aren't camelCase.
                taxes: Object.fromEntries([
                    ['id_TAX_EXEMPT', {name: 'Tax exempt', value: '0%'}],
                    ['id_TAX_RATE_1', {name: 'Tax Rate 1', value: '5%'}],
                ]),
            },
        },
        owner,
    );

    // Tax Rate 1 is 5% included in the amount: $20 carries $0.95.
    const taxReport = await createReport(owner, collect.policyID, 'Fixture Tax');
    const taxExpense = {chatReportID: collect.expenseChatReportID, iouReportID: taxReport};
    await requestMoney(owner, {...taxExpense, amount: 2000, merchant: 'Fixture Tax Pos', taxCode: 'id_TAX_RATE_1', taxAmount: 95});
    await requestMoney(owner, {...taxExpense, amount: -2000, merchant: 'Fixture Tax Neg', taxCode: 'id_TAX_RATE_1', taxAmount: -95});
    await requestMoney(owner, {...taxExpense, amount: -2000, merchant: 'Fixture Tax EUR', currency: 'EUR', taxCode: 'id_TAX_RATE_1', taxAmount: -95});
    await requestMoney(owner, {...taxExpense, amount: -1000, merchant: 'Fixture Tax Exempt', taxCode: 'id_TAX_EXEMPT'});

    const chatReportID = generateID();
    await callAPI(
        'SendMoneyElsewhere',
        {
            iouReportID: generateID(),
            chatReportID,
            reportActionID: generateID(),
            paymentMethodType: 'Elsewhere',
            transactionID: generateID(),
            newIOUReportDetails: {
                amount: 3000,
                currency: 'USD',
                requestorEmail: payee.email,
                requestorAccountID: payee.accountID,
                comment: '',
                idempotencyKey: crypto.randomUUID(),
                created: today(),
                merchant: 'Fixture Pay',
            },
            createdReportActionID: generateID(),
            reportPreviewReportActionID: generateID(),
            createdIOUReportActionID: generateID(),
            transactionThreadReportID: generateID(),
            createdReportActionIDForThread: generateID(),
        },
        owner,
    );
    await requestMoney(owner, {chatReportID, iouReportID: generateID(), amount: 725, merchant: 'Fixture Request', isNewReport: true, debtor: payee});

    return owner;
}

export default createSeededAccount;
export type {Account};
