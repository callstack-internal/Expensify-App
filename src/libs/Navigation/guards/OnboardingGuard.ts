import type {NavigationAction, NavigationState} from '@react-navigation/native';
import {findFocusedRoute} from '@react-navigation/native';
import type {OnyxEntry} from 'react-native-onyx';
import {getOnboardingInitialPath} from '@libs/actions/Welcome/OnboardingFlow';
import Log from '@libs/Log';
import {isOnboardingFlowName} from '@libs/Navigation/helpers/isNavigatorName';
import * as Welcome from '@userActions/Welcome';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import NAVIGATORS from '@src/NAVIGATORS';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import {hasCompletedGuidedSetupFlowSelector} from '@src/selectors/Onboarding';
import type {Onboarding} from '@src/types/onyx';
import type {GuardContext, GuardResult, NavigationGuard} from './types';

/**
 * Checks if onboarding is completed
 */
function isOnboardingCompleted(onboarding: OnyxEntry<Onboarding>): boolean {
    return hasCompletedGuidedSetupFlowSelector(onboarding) === true;
}

/**
 * Checks if test drive modal should be shown
 */
function shouldShowTestDriveModal(onboarding: OnyxEntry<Onboarding>): boolean {
    // The value `undefined` should not be used here because `testDriveModalDismissed` may not always exist in `onboarding`.
    // So we only compare it to `false` to avoid unintentionally opening the test drive modal.
    return onboarding?.testDriveModalDismissed === false;
}

/**
 * Checks if the action is navigating away from onboarding
 */
function isNavigatingAwayFromOnboarding(state: NavigationState, action: NavigationAction): boolean {
    if (action.type !== CONST.NAVIGATION_ACTIONS.RESET || !('payload' in action) || !action.payload) {
        return false;
    }

    const currentFocusedRoute = findFocusedRoute(state);
    const targetFocusedRoute = findFocusedRoute(action.payload as NavigationState);

    return isOnboardingFlowName(currentFocusedRoute?.name) && !isOnboardingFlowName(targetFocusedRoute?.name);
}

/**
 * Checks if the action is navigating to an onboarding screen
 */
function isNavigatingToOnboarding(action: NavigationAction): boolean {
    if (!('payload' in action) || !action.payload || typeof action.payload !== 'object') {
        return false;
    }

    const payload = action.payload as Record<string, unknown>;

    if ('name' in payload && payload.name === NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR) {
        return true;
    }

    if ('name' in payload && typeof payload.name === 'string') {
        return payload.name === ROUTES.ONBOARDING_ROOT.route || payload.name.startsWith(`${ROUTES.ONBOARDING_ROOT.route}/`);
    }

    if (action.type === 'RESET' && 'routes' in payload && Array.isArray(payload.routes)) {
        return payload.routes.some((route: unknown) => {
            if (typeof route === 'object' && route !== null && 'name' in route) {
                const routeName = (route as Record<string, unknown>).name;
                return routeName === NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR;
            }
            return false;
        });
    }

    return false;
}

/**
 * Checks if the URL is a transition route
 */
function isTransitionRoute(url: string): boolean {
    return url.includes(ROUTES.TRANSITION_BETWEEN_APPS);
}

/**
 * Checks if the current navigation state is already showing an onboarding screen
 */
function isCurrentlyOnOnboarding(state: NavigationState): boolean {
    // Check if any route in the current state is the onboarding modal navigator
    return state.routes.some((route) => route.name === NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR);
}

/**
 * Checks if the current navigation state is already showing the test drive modal
 */
function isCurrentlyOnTestDriveModal(state: NavigationState): boolean {
    return state.routes.some((route) => route.name === NAVIGATORS.TEST_DRIVE_MODAL_NAVIGATOR);
}

/**
 * Checks if the current navigation state is already showing the explanation modal
 */
function isCurrentlyOnExplanationModal(state: NavigationState): boolean {
    return state.routes.some((route) => route.name === NAVIGATORS.EXPLANATION_MODAL_NAVIGATOR);
}

/**
 * Onboarding Guard
 */
const OnboardingGuard: NavigationGuard = {
    name: 'OnboardingGuard',

    shouldApply(state: NavigationState, action: NavigationAction, context: GuardContext): boolean {
        // Don't apply if still loading
        if (context.isLoading || context.isLoadingApp) {
            return false;
        }

        if (context.account?.needsTwoFactorAuthSetup && !context.account?.requiresTwoFactorAuth) {
            return false;
        }

        if (isTransitionRoute(context.currentUrl)) {
            return false;
        }

        if (CONFIG.IS_HYBRID_APP && context.isSingleNewDotEntry) {
            Log.info('[OnboardingGuard] Skipping for HybridApp single entry');
            return false;
        }

        return true;
    },

    evaluate(state: NavigationState, action: NavigationAction, context: GuardContext): GuardResult {
        const {onboarding, account, isHybridAppOnboardingCompleted} = context;

        if (CONFIG.IS_HYBRID_APP && isHybridAppOnboardingCompleted === false) {
            if (isCurrentlyOnExplanationModal(state)) {
                return {type: 'ALLOW'};
            }

            if (isNavigatingToOnboarding(action)) {
                return {type: 'ALLOW'};
            }

            Log.info('[OnboardingGuard] Redirecting to HybridApp explanation modal');
            return {
                type: 'REDIRECT',
                route: ROUTES.EXPLANATION_MODAL_ROOT as Route,
            };
        }

        if (!isOnboardingCompleted(onboarding)) {
            if (isCurrentlyOnOnboarding(state)) {
                if (isNavigatingAwayFromOnboarding(state, action)) {
                    Welcome.setOnboardingErrorMessage('onboarding.purpose.errorBackButton');
                    Log.info('[OnboardingGuard] Blocked navigation away from onboarding');
                    return {
                        type: 'BLOCK',
                        reason: 'Cannot navigate back during onboarding',
                    };
                }

                if (isNavigatingToOnboarding(action)) {
                    return {type: 'ALLOW'};
                }

                Log.info('[OnboardingGuard] Blocked navigation to non-onboarding screen while onboarding is active');
                return {
                    type: 'BLOCK',
                    reason: 'Cannot navigate away from onboarding',
                };
            }

            if (isNavigatingToOnboarding(action)) {
                return {type: 'ALLOW'};
            }

            // Not on onboarding yet, redirect to appropriate onboarding screen
            const onboardingPath = getOnboardingInitialPath({
                isUserFromPublicDomain: !!account?.isFromPublicDomain,
                hasAccessiblePolicies: !!account?.hasAccessibleDomainPolicies,
                onboardingValuesParam: onboarding,
                currentOnboardingPurposeSelected: context.onboardingPurposeSelected,
                currentOnboardingCompanySize: context.onboardingCompanySize,
                onboardingInitialPath: context.onboardingLastVisitedPath ?? '',
                onboardingValues: onboarding,
            });

            Log.info(`[OnboardingGuard] Redirecting to onboarding: ${onboardingPath}`);

            return {
                type: 'REDIRECT',
                route: onboardingPath as Route,
            };
        }

        if (shouldShowTestDriveModal(onboarding)) {
            if (isCurrentlyOnTestDriveModal(state)) {
                return {type: 'ALLOW'};
            }

            if (isNavigatingToOnboarding(action)) {
                return {type: 'ALLOW'};
            }

            Log.info('[OnboardingGuard] Redirecting to test drive modal');
            return {
                type: 'REDIRECT',
                route: ROUTES.TEST_DRIVE_MODAL_ROOT.route as Route,
            };
        }

        return {type: 'ALLOW'};
    },
};

export default OnboardingGuard;
