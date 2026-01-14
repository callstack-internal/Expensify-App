import {isSingleNewDotEntrySelector} from '@selectors/HybridApp';
import {hasCompletedGuidedSetupFlowSelector, tryNewDotOnyxSelector} from '@selectors/Onboarding';
import {emailSelector} from '@selectors/Session';
import {useEffect, useMemo, useRef} from 'react';
import {InteractionManager} from 'react-native';
import Log from '@libs/Log';
import getCurrentUrl from '@libs/Navigation/currentUrl';
import Navigation, {navigationRef} from '@libs/Navigation/Navigation';
import {buildCannedSearchQuery} from '@libs/SearchQueryUtils';
import {isLoggingInAsNewUser} from '@libs/SessionUtils';
import isProductTrainingElementDismissed from '@libs/TooltipUtils';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import NAVIGATORS from '@src/NAVIGATORS';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import isLoadingOnyxValue from '@src/types/utils/isLoadingOnyxValue';
import useOnyx from './useOnyx';

/**
 * Hook to report the user's onboarding status
 *
 * Warning: This hook should be used only once in the app
 */
function useOnboardingFlowRouter() {
    const currentUrl = getCurrentUrl();
    const [isLoadingApp = true] = useOnyx(ONYXKEYS.IS_LOADING_APP, {canBeMissing: true});
    const [onboardingValues, isOnboardingCompletedMetadata] = useOnyx(ONYXKEYS.NVP_ONBOARDING, {
        canBeMissing: true,
    });
    const [currentOnboardingPurposeSelected] = useOnyx(ONYXKEYS.ONBOARDING_PURPOSE_SELECTED, {canBeMissing: true});
    const [currentOnboardingCompanySize] = useOnyx(ONYXKEYS.ONBOARDING_COMPANY_SIZE, {canBeMissing: true});
    const [onboardingInitialPath, onboardingInitialPathMetadata] = useOnyx(ONYXKEYS.ONBOARDING_LAST_VISITED_PATH, {canBeMissing: true});
    const [account, accountMetadata] = useOnyx(ONYXKEYS.ACCOUNT, {canBeMissing: true});
    const isOnboardingLoading = isLoadingOnyxValue(onboardingInitialPathMetadata, accountMetadata);

    const [sessionEmail] = useOnyx(ONYXKEYS.SESSION, {canBeMissing: true, selector: emailSelector});
    const isLoggingInAsNewSessionUser = isLoggingInAsNewUser(currentUrl, sessionEmail);
    const started2FAFlowRef = useRef(false);
    const triggeredOnboardingNavigationRef = useRef(false);
    const [tryNewDot, tryNewDotMetadata] = useOnyx(ONYXKEYS.NVP_TRY_NEW_DOT, {
        selector: tryNewDotOnyxSelector,
        canBeMissing: true,
    });
    const {isHybridAppOnboardingCompleted, hasBeenAddedToNudgeMigration} = tryNewDot ?? {};

    const [dismissedProductTraining, dismissedProductTrainingMetadata] = useOnyx(ONYXKEYS.NVP_DISMISSED_PRODUCT_TRAINING, {canBeMissing: true});

    const [isSingleNewDotEntry, isSingleNewDotEntryMetadata] = useOnyx(ONYXKEYS.HYBRID_APP, {selector: isSingleNewDotEntrySelector, canBeMissing: true});
    const shouldShowRequire2FAPage = useMemo(
        () => (!!account?.needsTwoFactorAuthSetup && !account?.requiresTwoFactorAuth) || (!!account?.twoFactorAuthSetupInProgress && !hasCompletedGuidedSetupFlowSelector(onboardingValues)),
        [account?.needsTwoFactorAuthSetup, account?.requiresTwoFactorAuth, account?.twoFactorAuthSetupInProgress, onboardingValues],
    );

    useEffect(() => {
        // This should delay opening the onboarding modal so it does not interfere with the ongoing ReportScreen params changes
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const handle = InteractionManager.runAfterInteractions(() => {
            // Prevent starting the onboarding flow if we are logging in as a new user with short lived token
            if (currentUrl?.includes(ROUTES.TRANSITION_BETWEEN_APPS) && isLoggingInAsNewSessionUser) {
                return;
            }

            if (isLoadingApp !== false || isOnboardingLoading) {
                return;
            }

            if (isLoadingOnyxValue(isOnboardingCompletedMetadata, tryNewDotMetadata, dismissedProductTrainingMetadata)) {
                return;
            }

            if (CONFIG.IS_HYBRID_APP && isLoadingOnyxValue(isSingleNewDotEntryMetadata)) {
                return;
            }

            if (currentUrl.endsWith('/r')) {
                // Don't trigger onboarding if we are in the middle of a redirect to a report
                return;
            }

            if (shouldShowRequire2FAPage) {
                if (started2FAFlowRef.current) {
                    return;
                }
                started2FAFlowRef.current = true;
                Navigation.navigate(ROUTES.REQUIRE_TWO_FACTOR_AUTH);
                return;
            }

            if (hasBeenAddedToNudgeMigration && !isProductTrainingElementDismissed('migratedUserWelcomeModal', dismissedProductTraining)) {
                const navigationState = navigationRef.getRootState();
                const lastRoute = navigationState.routes.at(-1);
                // Prevent duplicate navigation if the migrated user modal is already shown.
                if (lastRoute?.name !== NAVIGATORS.MIGRATED_USER_MODAL_NAVIGATOR) {
                    Navigation.navigate(ROUTES.SEARCH_ROOT.getRoute({query: buildCannedSearchQuery({type: CONST.SEARCH.DATA_TYPES.EXPENSE_REPORT})}));
                    Navigation.navigate(ROUTES.MIGRATED_USER_WELCOME_MODAL.getRoute(true));
                }
                return;
            }

            if (hasBeenAddedToNudgeMigration) {
                return;
            }

            const isOnboardingCompleted = hasCompletedGuidedSetupFlowSelector(onboardingValues);
            const isAlreadyOnOnboarding = currentUrl.includes(`/${ROUTES.ONBOARDING_ROOT.route}`);

            if (CONFIG.IS_HYBRID_APP) {
                // For single entries, such as using the Travel feature from OldDot, we don't want to show onboarding
                if (isSingleNewDotEntry) {
                    return;
                }

                if (isHybridAppOnboardingCompleted === true && isOnboardingCompleted === false && !triggeredOnboardingNavigationRef.current && !isAlreadyOnOnboarding) {
                    triggeredOnboardingNavigationRef.current = true;
                    Log.info('[Onboarding] Triggering navigation for incomplete onboarding (guard will redirect)');
                    Navigation.navigate(ROUTES.HOME);
                }
            }

            if (!CONFIG.IS_HYBRID_APP && isOnboardingCompleted === false && !triggeredOnboardingNavigationRef.current && !isAlreadyOnOnboarding) {
                triggeredOnboardingNavigationRef.current = true;
                Log.info('[Onboarding] Triggering navigation for incomplete onboarding (guard will redirect)');
                Navigation.navigate(ROUTES.HOME);
            }
        });

        return () => {
            handle.cancel();
        };
    }, [
        isLoadingApp,
        isHybridAppOnboardingCompleted,
        isOnboardingCompletedMetadata,
        tryNewDotMetadata,
        isSingleNewDotEntryMetadata,
        isSingleNewDotEntry,
        hasBeenAddedToNudgeMigration,
        dismissedProductTrainingMetadata,
        dismissedProductTraining?.migratedUserWelcomeModal,
        onboardingValues,
        dismissedProductTraining,
        account?.isFromPublicDomain,
        account?.hasAccessibleDomainPolicies,
        currentUrl,
        isLoggingInAsNewSessionUser,
        currentOnboardingCompanySize,
        currentOnboardingPurposeSelected,
        onboardingInitialPath,
        isOnboardingLoading,
        shouldShowRequire2FAPage,
    ]);

    return {
        isOnboardingCompleted: hasCompletedGuidedSetupFlowSelector(onboardingValues),
        isHybridAppOnboardingCompleted,
        shouldShowRequire2FAPage,
        isOnboardingLoading: !!onboardingValues?.isLoading,
    };
}

export default useOnboardingFlowRouter;
