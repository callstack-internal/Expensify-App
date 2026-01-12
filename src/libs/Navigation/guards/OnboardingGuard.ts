import type {NavigationAction, NavigationState} from '@react-navigation/native';
import {findFocusedRoute} from '@react-navigation/native';
import type {OnyxEntry} from 'react-native-onyx';
import {getOnboardingInitialPath} from '@libs/actions/Welcome/OnboardingFlow';
import {isOnboardingFlowName} from '@libs/Navigation/helpers/isNavigatorName';
import Log from '@libs/Log';
import * as Welcome from '@userActions/Welcome';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import NAVIGATORS from '@src/NAVIGATORS';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import {hasCompletedGuidedSetupFlowSelector} from '@src/selectors/Onboarding';
import type {Account, Onboarding} from '@src/types/onyx';
import type {GuardContext, GuardResult, NavigationGuard} from './types';

/**
 * Checks if onboarding is completed
 *
 * Note: This only checks if the guided setup flow is complete.
 * The test drive modal is shown separately and should not block navigation.
 */
function isOnboardingCompleted(onboarding: OnyxEntry<Onboarding>): boolean {
    return hasCompletedGuidedSetupFlowSelector(onboarding) === true;
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

    // Check if currently on onboarding and trying to navigate to non-onboarding
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

    // Check if navigating to ONBOARDING_MODAL_NAVIGATOR
    if ('name' in payload && payload.name === NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR) {
        return true;
    }

    // Check if the route starts with onboarding paths
    if ('name' in payload && typeof payload.name === 'string') {
        const onboardingRoutes = [
            ROUTES.ONBOARDING_ROOT.route,
            ROUTES.ONBOARDING_PERSONAL_DETAILS.route,
            ROUTES.ONBOARDING_PURPOSE.route,
            ROUTES.ONBOARDING_ACCOUNTING.route,
            ROUTES.ONBOARDING_EMPLOYEES.route,
            ROUTES.ONBOARDING_WORK_EMAIL.route,
            ROUTES.TEST_DRIVE_MODAL_ROOT.route,
        ];

        return onboardingRoutes.some((route) => payload.name === route || (typeof payload.name === 'string' && payload.name.startsWith(route)));
    }

    // Check if it's a RESET action with onboarding routes
    if (action.type === 'RESET' && 'routes' in payload && Array.isArray(payload.routes)) {
        // Check if any route in the RESET action is an onboarding route
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
 * Onboarding Guard
 *
 * Manages onboarding flow redirects:
 * - Redirects to onboarding if not completed
 * - Prevents back navigation during onboarding
 * - Handles HybridApp special cases
 */
const OnboardingGuard: NavigationGuard = {
    name: 'OnboardingGuard',

    shouldApply(state: NavigationState, action: NavigationAction, context: GuardContext): boolean {
        // Don't apply if still loading
        if (context.isLoading || context.isLoadingApp) {
            return false;
        }

        // Don't apply if 2FA is required (higher priority guard handles this)
        if (context.account?.needsTwoFactorAuthSetup && !context.account?.requiresTwoFactorAuth) {
            return false;
        }

        // Don't apply if on transition route
        if (isTransitionRoute(context.currentUrl)) {
            return false;
        }

        // Don't apply for HybridApp single entry
        if (CONFIG.IS_HYBRID_APP && context.isSingleNewDotEntry) {
            Log.info('[OnboardingGuard] Skipping for HybridApp single entry');
            return false;
        }

        // Apply the guard
        return true;
    },

    evaluate(state: NavigationState, action: NavigationAction, context: GuardContext): GuardResult {
        const {onboarding, account} = context;

        // Check if onboarding is completed
        if (isOnboardingCompleted(onboarding)) {
            return {type: 'ALLOW'};
        }

        // If already on an onboarding screen, allow navigation within onboarding
        if (isCurrentlyOnOnboarding(state)) {
            // Still prevent back navigation away from onboarding
            if (isNavigatingAwayFromOnboarding(state, action)) {
                Welcome.setOnboardingErrorMessage('onboarding.purpose.errorBackButton');
                Log.info('[OnboardingGuard] Blocked navigation away from onboarding');
                return {
                    type: 'BLOCK',
                    reason: 'Cannot navigate back during onboarding',
                };
            }

            // Allow all other navigation while on onboarding
            return {type: 'ALLOW'};
        }

        // If already navigating to onboarding, allow it
        if (isNavigatingToOnboarding(action)) {
            return {type: 'ALLOW'};
        }

        // Determine which onboarding screen to redirect to
        const onboardingPath = getOnboardingInitialPath({
            isUserFromPublicDomain: !!account?.isFromPublicDomain,
            hasAccessiblePolicies: !!account?.hasAccessibleDomainPolicies,
            onboardingValuesParam: onboarding,
            currentOnboardingPurposeSelected: undefined, // Will be loaded from Onyx by the function
            currentOnboardingCompanySize: undefined, // Will be loaded from Onyx by the function
            onboardingInitialPath: undefined, // Will be loaded from Onyx by the function
            onboardingValues: onboarding,
        });

        Log.info(`[OnboardingGuard] Redirecting to onboarding: ${onboardingPath}`);

        return {
            type: 'REDIRECT',
            route: onboardingPath as Route,
        };
    },
};

export default OnboardingGuard;
