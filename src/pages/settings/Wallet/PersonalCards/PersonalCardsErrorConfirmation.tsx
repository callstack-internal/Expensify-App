import React from 'react';
import ConfirmationPage from '@components/ConfirmationPage';
import Text from '@components/Text';
import TextLink from '@components/TextLink';
import {useMemoizedLazyIllustrations} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@navigation/Navigation';
import {deletePersonalCard, setAddNewPersonalCardStepAndData} from '@userActions/PersonalCards';
import CONST from '@src/CONST';

function PersonalCardsErrorConfirmation({cardID}: {cardID?: number}) {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const illustrations = useMemoizedLazyIllustrations(['BrokenCompanyCardBankConnection']);

    const deleteCompanyCardFeed = () => {
        if (!cardID) {
            return;
        }
        deletePersonalCard(cardID);
    };

    const onButtonPress = () => {
        deleteCompanyCardFeed();
        Navigation.closeRHPFlow();
    };

    const openPlaidLink = () => {
        setAddNewPersonalCardStepAndData({
            step: CONST.PERSONAL_CARDS.STEP.PLAID_CONNECTION,
            data: {
                selectedBank: CONST.PERSONAL_CARDS.BANKS.OTHER,
                cardTitle: undefined,
                feedType: undefined,
            },
            isEditing: false,
        });
    };

    return (
        <ConfirmationPage
            heading={translate('workspace.moreFeatures.companyCards.bankConnectionError')}
            description={
                <Text style={[styles.textSupporting, styles.textAlignCenter]}>
                    {translate('workspace.moreFeatures.companyCards.bankConnectionDescription')}{' '}
                    <TextLink
                        style={[styles.link]}
                        onPress={openPlaidLink}
                    >
                        {translate('workspace.moreFeatures.companyCards.connectWithPlaid')}
                    </TextLink>
                </Text>
            }
            illustration={illustrations.BrokenCompanyCardBankConnection}
            shouldShowButton
            illustrationStyle={styles.errorStateCardIllustration}
            onButtonPress={onButtonPress}
            buttonText={translate('common.buttonConfirm')}
            containerStyle={styles.h100}
        />
    );
}

export default PersonalCardsErrorConfirmation;
