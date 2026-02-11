import React, {useCallback, useState} from 'react';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import useBlockNavigationShortcuts from '@hooks/useBlockNavigationShortcuts';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import usePlaidBankLoginInit from '@hooks/usePlaidBankLoginInit';
import useThemeStyles from '@hooks/useThemeStyles';
import {handlePlaidError, openPlaidBankAccountSelector, openPlaidBankLogin, setPlaidEvent} from '@libs/actions/BankAccounts';
import Log from '@libs/Log';
import {handleRestrictedEvent} from '@userActions/App';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {PlaidData} from '@src/types/onyx';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import ActivityIndicator from './ActivityIndicator';
import FullPageOfflineBlockingView from './BlockingViews/FullPageOfflineBlockingView';
import FormHelpMessage from './FormHelpMessage';
import Icon from './Icon';
import getBankIcon from './Icon/BankIcons';
import PlaidLink from './PlaidLink';
import RadioButtons from './RadioButtons';
import Text from './Text';

type AddPlaidBankAccountProps = {
    /** Contains plaid data */
    plaidData: OnyxEntry<PlaidData>;

    /** Selected account ID from the Picker associated with the end of the Plaid flow */
    selectedPlaidAccountID?: string;

    /** Fired when the user exits the Plaid flow */
    onExitPlaid?: () => void;

    /** Fired when the user selects an account */
    onSelect?: (plaidAccountID: string) => void;

    /** Additional text to display */
    text?: string;

    /** The OAuth URI + stateID needed to re-initialize the PlaidLink after the user logs into their bank */
    receivedRedirectURI?: string;

    /** During the OAuth flow we need to use the plaidLink token that we initially connected with */
    plaidLinkOAuthToken?: string;

    /** If we're updating an existing bank account, what's its bank account ID? */
    bankAccountID?: number;

    /** Are we adding a withdrawal account? */
    allowDebit?: boolean;

    /** Is displayed in new enable wallet flow */
    isDisplayedInWalletFlow?: boolean;

    /** Text to display on error message */
    errorText?: string;

    /** Function called whenever radio button value changes */
    onInputChange?: (plaidAccountID: string) => void;
};

function AddPlaidBankAccount({
    plaidData,
    selectedPlaidAccountID = '',
    onExitPlaid = () => {},
    onSelect = () => {},
    text = '',
    receivedRedirectURI,
    plaidLinkOAuthToken = '',
    bankAccountID = 0,
    allowDebit = false,
    errorText = '',
    onInputChange = () => {},
    isDisplayedInWalletFlow = false,
}: AddPlaidBankAccountProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const [plaidLinkToken] = useOnyx(ONYXKEYS.PLAID_LINK_TOKEN, {canBeMissing: true, initWithStoredValues: false});
    const [isPlaidDisabled] = useOnyx(ONYXKEYS.IS_PLAID_DISABLED, {canBeMissing: true});

    const plaidBankAccounts = plaidData?.bankAccounts ?? [];
    const defaultSelectedPlaidAccount = plaidBankAccounts.find((account) => account.plaidAccountID === selectedPlaidAccountID);
    const defaultSelectedPlaidAccountID = defaultSelectedPlaidAccount?.plaidAccountID;
    const defaultSelectedPlaidAccountMask = defaultSelectedPlaidAccount?.mask ?? '';
    const isAuthenticated = (!!receivedRedirectURI && !!plaidLinkOAuthToken) || !!plaidData?.bankAccounts?.length || !isEmptyObject(plaidData?.errors);
    const token = plaidLinkToken ?? (receivedRedirectURI && plaidLinkOAuthToken ? plaidLinkOAuthToken : undefined);
    const plaidErrors = plaidData?.errors;
    const plaidDataErrorMessage = !isEmptyObject(plaidErrors) ? (Object.values(plaidErrors).at(0) ?? '') : '';
    const bankName = plaidData?.bankName;
    const options = plaidBankAccounts.map((account) => ({
        value: account.plaidAccountID,
        label: account.addressName ?? '',
    }));
    const {icon, iconSize, iconStyles} = getBankIcon({styles});

    const [selectedPlaidAccountMask, setSelectedPlaidAccountMask] = useState(defaultSelectedPlaidAccountMask);

    useBlockNavigationShortcuts(plaidBankAccounts.length > 0);

    usePlaidBankLoginInit({
        isAuthenticated,
        loginFn: useCallback(() => {
            openPlaidBankLogin(allowDebit, bankAccountID);
        }, [allowDebit, bankAccountID]),
    });

    const handleSelectingPlaidAccount = (plaidAccountID: string) => {
        const mask = plaidBankAccounts.find((account) => account.plaidAccountID === plaidAccountID)?.mask ?? '';
        setSelectedPlaidAccountMask(mask);
        onSelect(plaidAccountID);
        onInputChange(plaidAccountID);
    };

    const handlePlaidLinkError = useCallback((error: ErrorEvent | null) => {
        Log.hmmm('[PlaidLink] Error: ', error?.message);
    }, []);

    if (isPlaidDisabled) {
        return (
            <View>
                <Text style={[styles.formError]}>{translate('bankAccount.error.tooManyAttempts')}</Text>
            </View>
        );
    }

    if (!plaidBankAccounts.length) {
        let plaidLinkContent;
        if (token && !bankName) {
            plaidLinkContent = (
                <PlaidLink
                    token={token}
                    onSuccess={({publicToken, metadata}) => {
                        Log.info('[PlaidLink] Success!');
                        openPlaidBankAccountSelector(publicToken, metadata?.institution?.name ?? '', allowDebit, bankAccountID);
                    }}
                    onError={handlePlaidLinkError}
                    onEvent={(event, metadata) => {
                        setPlaidEvent(event);
                        if (event === 'ERROR') {
                            Log.hmmm('[PlaidLink] Error: ', {...metadata});
                            if (bankAccountID && metadata && 'error_code' in metadata) {
                                handlePlaidError(bankAccountID, metadata.error_code ?? '', metadata.error_message ?? '', metadata.request_id);
                            }
                        }
                        if (event === 'SUBMIT_CREDENTIALS') {
                            handleRestrictedEvent(event);
                        }
                    }}
                    onExit={onExitPlaid}
                    receivedRedirectURI={receivedRedirectURI}
                />
            );
        } else if (plaidDataErrorMessage) {
            plaidLinkContent = <Text style={[styles.formError, styles.mh5]}>{plaidDataErrorMessage}</Text>;
        } else if (plaidData?.isLoading) {
            plaidLinkContent = (
                <View style={[styles.flex1, styles.alignItemsCenter, styles.justifyContentCenter]}>
                    <ActivityIndicator size={CONST.ACTIVITY_INDICATOR_SIZE.LARGE} />
                </View>
            );
        } else {
            plaidLinkContent = <View />;
        }

        return <FullPageOfflineBlockingView>{plaidLinkContent}</FullPageOfflineBlockingView>;
    }

    return (
        <FullPageOfflineBlockingView>
            <Text style={[styles.mb3, styles.textHeadlineLineHeightXXL]}>{translate(isDisplayedInWalletFlow ? 'walletPage.chooseYourBankAccount' : 'bankAccount.chooseAnAccount')}</Text>
            {!!text && <Text style={[styles.mb6, styles.textSupporting]}>{text}</Text>}
            <View style={[styles.flexRow, styles.alignItemsCenter, styles.mb6]}>
                <Icon
                    src={icon}
                    height={iconSize}
                    width={iconSize}
                    additionalStyles={iconStyles}
                />
                <View>
                    <Text style={[styles.ml3, styles.textStrong]}>{bankName}</Text>
                    {selectedPlaidAccountMask.length > 0 && (
                        <Text style={[styles.ml3, styles.textLabelSupporting]}>{`${translate('bankAccount.accountEnding')} ${selectedPlaidAccountMask}`}</Text>
                    )}
                </View>
            </View>
            <Text style={[styles.textLabelSupporting]}>{`${translate('bankAccount.chooseAnAccountBelow')}:`}</Text>
            <RadioButtons
                items={options}
                defaultCheckedValue={defaultSelectedPlaidAccountID}
                onPress={handleSelectingPlaidAccount}
                radioButtonStyle={[styles.mb6]}
            />
            <FormHelpMessage message={errorText} />
        </FullPageOfflineBlockingView>
    );
}

export default AddPlaidBankAccount;
export type {AddPlaidBankAccountProps};
