import React, {useCallback, useEffect, useRef, useState} from 'react';
import ActivityIndicator from '@components/ActivityIndicator';
import BlockingView from '@components/BlockingViews/BlockingView';
import FullPageOfflineBlockingView from '@components/BlockingViews/FullPageOfflineBlockingView';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';
import TextLink from '@components/TextLink';
import useImportPersonalPlaidAccounts from '@hooks/useImportPersonalPlaidAccounts';
import {useMemoizedLazyIllustrations} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import useThemeStyles from '@hooks/useThemeStyles';
import {filterPersonalCards, getBankName, getCompanyCardFeed} from '@libs/CardUtils';
import Navigation from '@navigation/Navigation';
import type {PlatformStackRouteProp} from '@navigation/PlatformStackNavigation/types';
import type {SettingsNavigatorParamList} from '@navigation/types';
import PersonalCardsErrorConfirmation from '@pages/settings/Wallet/PersonalCards/PersonalCardsErrorConfirmation';
import {setAddNewCompanyCardStepAndData} from '@userActions/CompanyCards';
import {getPersonalCardBankConnection} from '@userActions/getCompanyCardBankConnection';
import {setAddNewPersonalCardStepAndData} from '@userActions/PersonalCards';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';
import type {Card, CardList, CompanyCardFeedWithDomainID} from '@src/types/onyx';
import {getEmptyObject} from '@src/types/utils/EmptyObject';
import openBankConnection from './openBankConnection';

let customWindow: Window | null = null;

type BankConnectionProps = {
    /** Selected feed for assign card flow */
    feed?: CompanyCardFeedWithDomainID;

    /** Route params for add new card flow */
    route?: PlatformStackRouteProp<SettingsNavigatorParamList, typeof SCREENS.SETTINGS.WALLET.PERSONAL_CARD_BANK_CONNECTION>;
};

function BankConnection({feed, route}: BankConnectionProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const [addNewCard] = useOnyx(ONYXKEYS.ADD_NEW_PERSONAL_CARD, {canBeMissing: true});
    const [assignCard] = useOnyx(ONYXKEYS.ASSIGN_CARD, {canBeMissing: true});
    const [cardList = getEmptyObject<CardList>()] = useOnyx(ONYXKEYS.CARD_LIST, {selector: filterPersonalCards, canBeMissing: true});
    const {feed: bankNameFromRoute} = route?.params ?? {};
    const [newCard, setNewCard] = useState<Card | null>(null);
    const illustrations = useMemoizedLazyIllustrations(['PendingBank']);
    const [shouldBlockWindowOpen, setShouldBlockWindowOpen] = useState(false);
    const selectedBank = addNewCard?.data?.selectedBank;
    const bankName = feed ? getBankName(getCompanyCardFeed(feed)) : (bankNameFromRoute ?? addNewCard?.data?.plaidConnectedFeed ?? selectedBank);
    const {isOffline} = useNetwork();
    const plaidToken = addNewCard?.data?.publicToken ?? assignCard?.cardToAssign?.plaidAccessToken;
    const isPlaid = !!plaidToken;
    const url = getPersonalCardBankConnection(bankName);
    const headerTitleAddCards = translate('workspace.companyCards.addCards');
    const headerTitle = feed ? translate('workspace.companyCards.assignCard') : headerTitleAddCards;
    const onImportPlaidAccounts = useImportPersonalPlaidAccounts();
    const prevCardListRef = useRef<Record<string, Card>>({});

    useEffect(() => {
        const prevCardList = prevCardListRef.current;
        const prevIds = new Set(Object.keys(prevCardList));
        const currentIds = Object.keys(cardList);
        const newCardIds = currentIds.filter((id) => !prevIds.has(id));
        if (newCardIds.length > 0) {
            for (const id of newCardIds) {
                setNewCard(cardList[id]);
            }
        }

        prevCardListRef.current = cardList;
    }, [cardList]);

    const onOpenBankConnectionFlow = useCallback(() => {
        if (!url) {
            return;
        }
        customWindow = openBankConnection(url);
    }, [url]);

    const handleBackButtonPress = () => {
        customWindow?.close();

        // Handle assign card flow
        if (feed) {
            Navigation.goBack();
            return;
        }
        setAddNewCompanyCardStepAndData({step: CONST.COMPANY_CARDS.STEP.SELECT_BANK});
    };

    const CustomSubtitle = (
        <Text style={[styles.textAlignCenter, styles.textSupporting]}>
            {bankName && translate(`workspace.moreFeatures.companyCards.pendingBankDescription`, addNewCard?.data?.plaidConnectedFeedName ?? bankName)}
            <TextLink onPress={onOpenBankConnectionFlow}>{translate('workspace.moreFeatures.companyCards.pendingBankLink')}</TextLink>.
        </Text>
    );

    useEffect(() => {
        if ((!url && !isPlaid) || isOffline) {
            return;
        }
        // Handle add new card
        if (newCard) {
            setShouldBlockWindowOpen(true);
            customWindow?.close();
            setAddNewPersonalCardStepAndData({
                step: CONST.PERSONAL_CARDS.STEP.SUCCESS,
            });
            return;
        }
        if (!shouldBlockWindowOpen) {
            if (isPlaid) {
                onImportPlaidAccounts();
                return;
            }
            if (url) {
                customWindow = openBankConnection(url);
            }
        }
    }, [isOffline, isPlaid, newCard, onImportPlaidAccounts, shouldBlockWindowOpen, url]);

    const getContent = () => {
        if (newCard?.errors) {
            return <PersonalCardsErrorConfirmation cardID={newCard?.cardID} />;
        }
        if (!isPlaid) {
            return (
                <BlockingView
                    icon={illustrations.PendingBank}
                    iconWidth={styles.pendingBankCardIllustration.width}
                    iconHeight={styles.pendingBankCardIllustration.height}
                    title={translate('workspace.moreFeatures.companyCards.pendingBankTitle')}
                    CustomSubtitle={CustomSubtitle}
                    onLinkPress={onOpenBankConnectionFlow}
                    addBottomSafeAreaPadding
                />
            );
        }
        return (
            <ActivityIndicator
                size={CONST.ACTIVITY_INDICATOR_SIZE.LARGE}
                style={styles.flex1}
            />
        );
    };

    return (
        <ScreenWrapper
            testID="BankConnection"
            enableEdgeToEdgeBottomSafeAreaPadding
        >
            <HeaderWithBackButton
                title={headerTitle}
                onBackButtonPress={handleBackButtonPress}
            />
            <FullPageOfflineBlockingView addBottomSafeAreaPadding>{getContent()}</FullPageOfflineBlockingView>
        </ScreenWrapper>
    );
}

export default BankConnection;
