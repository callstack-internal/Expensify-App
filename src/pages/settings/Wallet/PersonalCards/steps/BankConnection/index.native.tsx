import React, {useEffect, useRef, useState} from 'react';
import type {WebViewNavigation} from 'react-native-webview';
import {WebView} from 'react-native-webview';
import ActivityIndicator from '@components/ActivityIndicator';
import FullPageOfflineBlockingView from '@components/BlockingViews/FullPageOfflineBlockingView';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import useImportPersonalPlaidAccounts from '@hooks/useImportPersonalPlaidAccounts';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useThemeStyles from '@hooks/useThemeStyles';
import {filterPersonalCards, getBankName, getCompanyCardFeed} from '@libs/CardUtils';
import getUAForWebView from '@libs/getUAForWebView';
import Navigation from '@navigation/Navigation';
import type {PlatformStackRouteProp} from '@navigation/PlatformStackNavigation/types';
import type {SettingsNavigatorParamList} from '@navigation/types';
import PersonalCardsErrorConfirmation from '@pages/settings/Wallet/PersonalCards/PersonalCardsErrorConfirmation';
import {getPersonalCardBankConnection} from '@userActions/getCompanyCardBankConnection';
import {setAddNewPersonalCardStepAndData} from '@userActions/PersonalCards';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type {Card, CardList, CompanyCardFeedWithDomainID} from '@src/types/onyx';
import {getEmptyObject} from '@src/types/utils/EmptyObject';

type BankConnectionProps = {
    /** Selected feed for assign card flow */
    feed?: CompanyCardFeedWithDomainID;

    /** Route params for add new card flow */
    route?: PlatformStackRouteProp<SettingsNavigatorParamList, typeof SCREENS.SETTINGS.WALLET.PERSONAL_CARD_BANK_CONNECTION>;
};

function BankConnection({feed, route}: BankConnectionProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const [newCard, setNewCard] = useState<Card | null>(null);
    const webViewRef = useRef<WebView>(null);
    const [session] = useOnyx(ONYXKEYS.SESSION, {canBeMissing: false});
    const [assignCard] = useOnyx(ONYXKEYS.ASSIGN_CARD, {canBeMissing: true});
    const [cardList = getEmptyObject<CardList>()] = useOnyx(ONYXKEYS.CARD_LIST, {selector: filterPersonalCards, canBeMissing: true});
    const authToken = session?.authToken ?? null;
    const [addNewCard] = useOnyx(ONYXKEYS.ADD_NEW_PERSONAL_CARD, {canBeMissing: true});
    const selectedBank = addNewCard?.data?.selectedBank;
    const {feed: bankNameFromRoute} = route?.params ?? {};
    const bankName = feed ? getBankName(getCompanyCardFeed(feed)) : (bankNameFromRoute ?? addNewCard?.data?.plaidConnectedFeed ?? selectedBank);
    const plaidToken = addNewCard?.data?.publicToken ?? assignCard?.cardToAssign?.plaidAccessToken;
    const isPlaid = !!plaidToken;
    const url = getPersonalCardBankConnection(bankName);
    const [isConnectionCompleted, setConnectionCompleted] = useState(false);
    const headerTitleAddCards = translate('workspace.companyCards.addCards');
    const headerTitle = feed ? translate('workspace.companyCards.assignCard') : headerTitleAddCards;
    const onImportPlaidAccounts = useImportPersonalPlaidAccounts();
    const isNewCardError = newCard?.errors;
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

    const renderLoading = () => <FullScreenLoadingIndicator />;

    const handleBackButtonPress = () => {
        // Handle assign card flow
        if (feed) {
            Navigation.goBack();
            return;
        }
        setAddNewPersonalCardStepAndData({step: CONST.PERSONAL_CARDS.STEP.SELECT_BANK});
    };

    useEffect(() => {
        if (!url && !isPlaid) {
            return;
        }

        // Handle add new card flow
        if (newCard) {
            setAddNewPersonalCardStepAndData({
                step: CONST.PERSONAL_CARDS.STEP.SUCCESS,
            });
        }
        if (isPlaid) {
            onImportPlaidAccounts();
        }
    }, [url, feed, assignCard?.cardToAssign?.dateOption, isPlaid, onImportPlaidAccounts, newCard]);

    const checkIfConnectionCompleted = (navState: WebViewNavigation) => {
        if (!navState.url.includes(ROUTES.BANK_CONNECTION_COMPLETE)) {
            return;
        }
        setConnectionCompleted(true);
    };

    return (
        <ScreenWrapper
            testID="BankConnection"
            shouldShowOfflineIndicator={false}
            shouldEnablePickerAvoiding={false}
            shouldEnableMaxHeight
        >
            <HeaderWithBackButton
                title={headerTitle}
                onBackButtonPress={handleBackButtonPress}
            />
            <FullPageOfflineBlockingView addBottomSafeAreaPadding>
                {!!url && !isConnectionCompleted && !isPlaid && !isNewCardError && (
                    <WebView
                        ref={webViewRef}
                        source={{
                            uri: url,
                            headers: {
                                Cookie: `authToken=${authToken}`,
                            },
                        }}
                        userAgent={getUAForWebView()}
                        incognito
                        onNavigationStateChange={checkIfConnectionCompleted}
                        startInLoadingState
                        renderLoading={renderLoading}
                    />
                )}
                {(isConnectionCompleted || isPlaid) && !isNewCardError && (
                    <ActivityIndicator
                        size={CONST.ACTIVITY_INDICATOR_SIZE.LARGE}
                        style={styles.flex1}
                    />
                )}
                {!!isNewCardError && <PersonalCardsErrorConfirmation cardID={newCard?.cardID} />}
            </FullPageOfflineBlockingView>
        </ScreenWrapper>
    );
}

export default BankConnection;
