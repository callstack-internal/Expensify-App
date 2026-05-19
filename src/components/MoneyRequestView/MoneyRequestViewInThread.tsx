import React from 'react';
import LiveTransactionProvider from './contexts/LiveTransactionProvider';
import ThreadProvider from './contexts/ThreadProvider';
import ViolationsProvider from './contexts/ViolationsProvider';

type MoneyRequestViewInThreadProps = {
    transactionID: string;
    parentReportID: string | undefined;
    policyID: string | undefined;
    children: React.ReactNode;
};

function MoneyRequestViewInThread({transactionID, parentReportID, policyID, children}: MoneyRequestViewInThreadProps) {
    return (
        <LiveTransactionProvider
            transactionID={transactionID}
            policyID={policyID}
        >
            <ThreadProvider
                parentReportID={parentReportID}
                transactionThreadReportID={transactionID}
                policyID={policyID}
            >
                <ViolationsProvider transactionID={transactionID}>{children}</ViolationsProvider>
            </ThreadProvider>
        </LiveTransactionProvider>
    );
}

export default MoneyRequestViewInThread;
