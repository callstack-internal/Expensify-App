type ImportPersonalPlaidAccountsParams = {
    publicToken: string;
    feed: string;
    feedName: string;
    country: string;
    plaidAccounts: string;
    plaidAccessToken?: string;
};

export default ImportPersonalPlaidAccountsParams;
