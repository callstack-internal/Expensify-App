import React from 'react';
import type {TupleToUnion} from 'type-fest';
import CurrencySelectionList from '@components/CurrencySelectionList';
import type {CurrencyListItem} from '@components/CurrencySelectionList/types';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import usePermissions from '@hooks/usePermissions';
import mapCurrencyToCountry from '@libs/mapCurrencyToCountry';
import BankAccount from '@libs/models/BankAccount';
import Navigation from '@libs/Navigation/Navigation';
import {goBackFromInvalidPolicy} from '@libs/PolicyUtils';
import {clearCorpayBankAccountFields} from '@userActions/BankAccounts';
import {clearDraftValues, setDraftValues} from '@userActions/FormActions';
import {isCurrencySupportedForGlobalReimbursement, setIsForcedToChangeCurrency, updateGeneralSettings} from '@userActions/Policy/Policy';
import {navigateToBankAccountRoute} from '@userActions/ReimbursementAccount';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import INPUT_IDS from '@src/types/form/ReimbursementAccountForm';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import AccessOrNotFoundWrapper from './AccessOrNotFoundWrapper';
import type {WithPolicyAndFullscreenLoadingProps} from './withPolicyAndFullscreenLoading';
import withPolicyAndFullscreenLoading from './withPolicyAndFullscreenLoading';

type WorkspaceOverviewCurrencyPageProps = WithPolicyAndFullscreenLoadingProps;
type CurrencyType = TupleToUnion<typeof CONST.DIRECT_REIMBURSEMENT_CURRENCIES>;

const {COUNTRY} = INPUT_IDS.ADDITIONAL_DATA;

function WorkspaceOverviewCurrencyPage({policy}: WorkspaceOverviewCurrencyPageProps) {
    const {translate} = useLocalize();
    const {isBetaEnabled} = usePermissions();
    const [isForcedToChangeCurrency] = useOnyx(ONYXKEYS.IS_FORCED_TO_CHANGE_CURRENCY, {canBeMissing: true});
    const [hasVBA = false] = useOnyx(ONYXKEYS.REIMBURSEMENT_ACCOUNT, {selector: (value) => value?.achData?.state === BankAccount.STATE.OPEN, canBeMissing: true});
    const onSelectCurrency = (item: CurrencyListItem) => {
        if (!policy) {
            return;
        }
        clearDraftValues(ONYXKEYS.FORMS.REIMBURSEMENT_ACCOUNT_FORM);
        setDraftValues(ONYXKEYS.FORMS.REIMBURSEMENT_ACCOUNT_FORM, {[COUNTRY]: mapCurrencyToCountry(item.currencyCode)});
        updateGeneralSettings(policy.id, policy?.name ?? '', item.currencyCode);
        clearCorpayBankAccountFields();

        if (isForcedToChangeCurrency) {
            setIsForcedToChangeCurrency(false);

            if (isCurrencySupportedForGlobalReimbursement(item.currencyCode as CurrencyType, isBetaEnabled(CONST.BETAS.GLOBAL_REIMBURSEMENTS_ON_ND) ?? false)) {
                navigateToBankAccountRoute(policy.id, ROUTES.WORKSPACE_WORKFLOWS.getRoute(policy.id), {forceReplace: true});
                return;
            }
        }
        Navigation.setNavigationActionToMicrotaskQueue(Navigation.goBack);
    };

    return (
        <AccessOrNotFoundWrapper
            policyID={policy?.id}
            accessVariants={[CONST.POLICY.ACCESS_VARIANTS.ADMIN]}
            shouldBeBlocked={hasVBA}
            fullPageNotFoundViewProps={{
                onLinkPress: hasVBA ? () => Navigation.goBack() : goBackFromInvalidPolicy,
                subtitleKey: hasVBA || isEmptyObject(policy) ? undefined : 'workspace.common.notAuthorized',
            }}
        >
            <ScreenWrapper
                enableEdgeToEdgeBottomSafeAreaPadding
                shouldEnableMaxHeight
                testID={WorkspaceOverviewCurrencyPage.displayName}
            >
                <HeaderWithBackButton
                    title={translate('workspace.editor.currencyInputLabel')}
                    onBackButtonPress={() => Navigation.goBack()}
                />

                <CurrencySelectionList
                    searchInputLabel={translate('workspace.editor.currencyInputLabel')}
                    onSelect={onSelectCurrency}
                    initiallySelectedCurrencyCode={policy?.outputCurrency}
                    addBottomSafeAreaPadding
                />
            </ScreenWrapper>
        </AccessOrNotFoundWrapper>
    );
}

WorkspaceOverviewCurrencyPage.displayName = 'WorkspaceOverviewCurrencyPage';

export default withPolicyAndFullscreenLoading(WorkspaceOverviewCurrencyPage);
