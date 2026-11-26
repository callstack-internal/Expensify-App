import type Transaction from '@src/types/onyx/Transaction';

import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';

const validTransactionDraftsSelector = (drafts: OnyxCollection<Transaction>): Record<string, Transaction> =>
    Object.values(drafts ?? {}).reduce<Record<string, Transaction>>((acc, draft) => {
        if (draft) {
            acc[draft.transactionID] = draft;
        }
        return acc;
    }, {});

const validTransactionDraftIDsSelector = (drafts: OnyxCollection<Transaction>): string[] =>
    Object.values(drafts ?? {}).reduce<string[]>((acc, draft) => {
        if (draft) {
            acc.push(draft.transactionID);
        }
        return acc;
    }, []);

/** Picks the receipt of one draft expense. */
const transactionDraftReceiptSelector = (draft: OnyxEntry<Transaction>) => draft?.receipt;

/** Counts the draft expenses that carry a receipt, e.g. the photos of a rapid fire session. */
const transactionDraftReceiptCountSelector = (drafts: OnyxCollection<Transaction>): number => Object.values(drafts ?? {}).filter((draft) => !!draft?.receipt?.source).length;

export {validTransactionDraftsSelector, validTransactionDraftIDsSelector, transactionDraftReceiptCountSelector, transactionDraftReceiptSelector};
