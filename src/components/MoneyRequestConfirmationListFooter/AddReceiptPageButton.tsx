/**
 * Add page: a small button on the Confirm details receipt preview that reopens the camera to take more pages of the
 * same receipt. It hides itself whenever the receipt can't take another page.
 */
import Button from '@components/Button';
import {useConfirmationFields} from '@components/MoneyRequestConfirmationFields/context';

import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import usePermissions from '@hooks/usePermissions';
import useThemeStyles from '@hooks/useThemeStyles';

import createDynamicRoute from '@libs/Navigation/helpers/dynamicRoutesUtils/createDynamicRoute';
import Navigation from '@libs/Navigation/Navigation';
import {canAddReceiptPage} from '@libs/ReceiptUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import {DYNAMIC_ROUTES} from '@src/ROUTES';
import {transactionDraftReceiptCountSelector, transactionDraftReceiptSelector} from '@src/selectors/TransactionDraft';

import React from 'react';

function AddReceiptPageButton() {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const icons = useMemoizedLazyExpensifyIcons(['Plus']);
    const {isBetaEnabled} = usePermissions();
    const {action, transactionID} = useConfirmationFields();
    const [receipt] = useOnyx(`${ONYXKEYS.COLLECTION.TRANSACTION_DRAFT}${transactionID}`, {selector: transactionDraftReceiptSelector});
    const [draftReceiptCount = 0] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION_DRAFT, {selector: transactionDraftReceiptCountSelector});

    // Pages are added only while creating, because an existing expense's receipt is already uploaded as one file
    if (!transactionID || action !== CONST.IOU.ACTION.CREATE || !isBetaEnabled(CONST.BETAS.MULTI_PAGE_RECEIPTS) || !canAddReceiptPage(receipt, draftReceiptCount)) {
        return null;
    }

    return (
        <Button
            size={CONST.BUTTON_SIZE.SMALL}
            style={styles.receiptAddPageButton}
            onPress={() => Navigation.navigate(createDynamicRoute(DYNAMIC_ROUTES.MONEY_REQUEST_ADD_RECEIPT_PAGE.getRoute(transactionID)))}
            sentryLabel={CONST.SENTRY_LABEL.REQUEST_CONFIRMATION_LIST.ADD_RECEIPT_PAGE}
        >
            <Button.Icon src={icons.Plus} />
            <Button.Text>{translate('receipt.addPage')}</Button.Text>
        </Button>
    );
}

export default AddReceiptPageButton;
