import React from 'react';
import {useLiveTransactionField} from '@components/MoneyRequestView/contexts/LiveTransactionProvider';
import {useSnapshotTransactionField} from '@components/MoneyRequestView/contexts/SnapshotTransactionProvider';
import FieldRow from '@components/MoneyRequestView/FieldRow';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import {getCompanyCardDescription} from '@libs/CardUtils';
import {isFromCreditCardImport as isCardTransactionTransactionUtils} from '@libs/TransactionUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Transaction} from '@src/types/onyx';

function useCardProgramName(transaction: Transaction | undefined) {
    const {translate} = useLocalize();
    const cardID = transaction?.cardID;
    const [card] = useOnyx(`${ONYXKEYS.CARD_LIST}`, {
        selector: (cards) => (cardID ? cards?.[cardID] : undefined),
    });
    const cards = card && cardID ? ({[cardID]: card} as Record<string, typeof card>) : undefined;
    return getCompanyCardDescription(translate, transaction?.cardName, cardID, cards);
}

function CardRow() {
    const transaction = useLiveTransactionField((tx: Transaction) => tx);
    const {translate} = useLocalize();
    const cardProgramName = useCardProgramName(transaction);
    const isFromCardImport = isCardTransactionTransactionUtils(transaction);

    if (!isFromCardImport || !cardProgramName) {
        return null;
    }

    return (
        <FieldRow
            pendingAction={transaction?.pendingFields?.cardID}
            description={translate('iou.card')}
            title={cardProgramName}
            numberOfLinesTitle={2}
            interactive={false}
            copyValue={cardProgramName}
            copyable={!!cardProgramName}
        />
    );
}

function CardRowSnapshot() {
    const transaction = useSnapshotTransactionField((tx: Transaction) => tx);
    const {translate} = useLocalize();
    const cardProgramName = useCardProgramName(transaction);
    const isFromCardImport = isCardTransactionTransactionUtils(transaction);

    if (!isFromCardImport || !cardProgramName) {
        return null;
    }

    return (
        <FieldRow
            description={translate('iou.card')}
            title={cardProgramName}
            numberOfLinesTitle={2}
            interactive={false}
        />
    );
}

export {CardRow, CardRowSnapshot};
