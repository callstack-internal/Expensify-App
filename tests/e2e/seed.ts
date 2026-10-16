import crypto from 'node:crypto';

type Account = {authToken: string; accountID: number; email: string};

type ApiResponse = {jsonCode: number; authToken?: string; email?: string; userMetadata?: {accountID: number}};

// Throwaway accounts on the staging backend, which signs up a new email without a magic code.
const API_ROOT = 'https://staging.expensify.com/api/';

const generateID = () => (crypto.randomInt(2 ** 21) * 2 ** 32 + crypto.randomInt(2 ** 32)).toString();
const generateHex = (length: number) => crypto.randomBytes(length).toString('hex').toUpperCase().slice(0, length);
const today = () => new Date().toISOString().slice(0, 10);

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
    const email = `e2e+${Date.now()}${crypto.randomInt(1000)}@tmtestdomain.com`;
    const response = await callAPI('SignUpUser', {email, preferredLocale: 'en', deviceInfo: '{}'});
    if (!response.authToken || !response.userMetadata) {
        throw new Error('SignUpUser returned no session');
    }
    const account = {authToken: response.authToken, accountID: response.userMetadata.accountID, email};
    await callAPI('SetNameValuePair', {name: 'nvp_onboarding', value: {hasCompletedGuidedSetupFlow: true}}, account);
    return account;
}

type ExpenseParams = {chatReportID: string; iouReportID: string; amount: number; merchant: string; isNewReport?: boolean; debtor?: Account};

function requestMoney(owner: Account, {chatReportID, iouReportID, amount, merchant, isNewReport = false, debtor}: ExpenseParams) {
    return callAPI(
        'RequestMoney',
        {
            // A workspace expense has no debtor; the backend bills the workspace.
            ...(debtor ? {debtorEmail: debtor.email, debtorAccountID: debtor.accountID} : {debtorEmail: '', debtorAccountID: 0}),
            amount,
            currency: 'USD',
            comment: '',
            created: today(),
            merchant,
            iouReportID,
            chatReportID,
            transactionID: generateID(),
            reportActionID: generateID(),
            ...(isNewReport && {createdIOUReportActionID: generateID()}),
            reportPreviewReportActionID: generateID(),
            taxCode: '',
            taxAmount: 0,
            transactionThreadReportID: generateID(),
            createdReportActionIDForThread: generateID(),
            reimbursable: true,
        },
        owner,
    );
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

/**
 * Signs up a fresh account that already has:
 * - "E2E Submit Workspace", a Submit workspace like the one "Submit to my employer" onboarding creates
 * - report "Fixture A" with one expense and report "Fixture B" with two, both drafts in that workspace
 * - a 1:1 chat with a second fresh account holding a paid "Fixture Pay" payment and an outstanding "Fixture Request" money request
 */
async function createSeededAccount(): Promise<Account> {
    const [owner, payee] = await Promise.all([signUp(), signUp()]);

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
            policyName: 'E2E Submit Workspace',
            type: 'submit2026',
            adminsCreatedReportActionID: generateID(),
            expenseCreatedReportActionID: generateID(),
            customUnitID: generateHex(13),
            customUnitRateID: generateHex(13),
            currency: 'USD',
            engagementChoice: 'newDotEmployer',
        },
        owner,
    );

    // A Submit workspace files every new expense into its one open report, so the reports are created first.
    const reportA = await createReport(owner, policyID, 'Fixture A');
    await requestMoney(owner, {chatReportID: expenseChatReportID, iouReportID: reportA, amount: 1200, merchant: 'Fixture A Cafe'});
    const reportB = await createReport(owner, policyID, 'Fixture B');
    await requestMoney(owner, {chatReportID: expenseChatReportID, iouReportID: reportB, amount: 500, merchant: 'Fixture B Shop'});
    await requestMoney(owner, {chatReportID: expenseChatReportID, iouReportID: reportB, amount: 900, merchant: 'Fixture B Bakery'});

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
