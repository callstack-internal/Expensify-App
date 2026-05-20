import {act, render} from '@testing-library/react-native';
import React, {Profiler} from 'react';
import Onyx from 'react-native-onyx';
import LiveTransactionProvider, {useLiveTransactionField} from '@components/MoneyRequestView/contexts/LiveTransactionProvider';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Transaction} from '@src/types/onyx';
import waitForBatchedUpdatesWithAct from '../../../utils/waitForBatchedUpdatesWithAct';

const TRANSACTION_ID = 'txn-cascade-1';
const POLICY_ID = 'policy-cascade-1';

const INITIAL_TX = {
    transactionID: TRANSACTION_ID,
    amount: 1000,
    currency: 'USD',
    merchant: 'Acme Coffee',
    comment: {comment: 'Lunch'},
    category: 'Food',
} as unknown as Transaction;

function AmountConsumer() {
    const amount = useLiveTransactionField((tx) => tx?.amount);
    return <>{String(amount ?? '')}</>;
}

function MerchantConsumer() {
    const merchant = useLiveTransactionField((tx) => tx?.merchant);
    return <>{String(merchant ?? '')}</>;
}

function CategoryConsumer() {
    const category = useLiveTransactionField((tx) => tx?.category);
    return <>{String(category ?? '')}</>;
}

type CountsApi = {
    get: (id: string) => number;
    onRender: (id: string) => void;
};

function makeCounts(): CountsApi {
    const map = new Map<string, number>();
    return {
        get: (id) => map.get(id) ?? 0,
        onRender: (id) => {
            map.set(id, (map.get(id) ?? 0) + 1);
        },
    };
}

describe('MoneyRequestView render cascade — selector narrowing via useLiveTransactionField', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        await Onyx.clear();
        await Onyx.merge(`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`, INITIAL_TX);
        await waitForBatchedUpdatesWithAct();
    });

    afterAll(async () => {
        await Onyx.clear();
    });

    it('amount mutation re-renders only the AmountConsumer; merchant and category consumers stay still', async () => {
        const counts = makeCounts();

        render(
            <LiveTransactionProvider
                transactionID={TRANSACTION_ID}
                policyID={POLICY_ID}
            >
                <Profiler
                    id="amount"
                    onRender={counts.onRender}
                >
                    <AmountConsumer />
                </Profiler>
                <Profiler
                    id="merchant"
                    onRender={counts.onRender}
                >
                    <MerchantConsumer />
                </Profiler>
                <Profiler
                    id="category"
                    onRender={counts.onRender}
                >
                    <CategoryConsumer />
                </Profiler>
            </LiveTransactionProvider>,
        );

        await waitForBatchedUpdatesWithAct();

        const amountBefore = counts.get('amount');
        const merchantBefore = counts.get('merchant');
        const categoryBefore = counts.get('category');

        await act(async () => {
            await Onyx.merge(`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`, {amount: 99999});
        });
        await waitForBatchedUpdatesWithAct();

        expect(counts.get('amount')).toBeGreaterThan(amountBefore);
        expect(counts.get('merchant')).toBe(merchantBefore);
        expect(counts.get('category')).toBe(categoryBefore);
    });

    it('merchant mutation re-renders only the MerchantConsumer', async () => {
        const counts = makeCounts();

        render(
            <LiveTransactionProvider
                transactionID={TRANSACTION_ID}
                policyID={POLICY_ID}
            >
                <Profiler
                    id="amount"
                    onRender={counts.onRender}
                >
                    <AmountConsumer />
                </Profiler>
                <Profiler
                    id="merchant"
                    onRender={counts.onRender}
                >
                    <MerchantConsumer />
                </Profiler>
                <Profiler
                    id="category"
                    onRender={counts.onRender}
                >
                    <CategoryConsumer />
                </Profiler>
            </LiveTransactionProvider>,
        );

        await waitForBatchedUpdatesWithAct();

        const amountBefore = counts.get('amount');
        const merchantBefore = counts.get('merchant');
        const categoryBefore = counts.get('category');

        await act(async () => {
            await Onyx.merge(`${ONYXKEYS.COLLECTION.TRANSACTION}${TRANSACTION_ID}`, {merchant: 'Different Merchant'});
        });
        await waitForBatchedUpdatesWithAct();

        expect(counts.get('merchant')).toBeGreaterThan(merchantBefore);
        expect(counts.get('amount')).toBe(amountBefore);
        expect(counts.get('category')).toBe(categoryBefore);
    });
});
