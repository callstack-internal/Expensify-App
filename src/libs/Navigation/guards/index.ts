import type {NavigationAction, NavigationState} from '@react-navigation/native';
import Onyx from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import {isSingleNewDotEntrySelector} from '@selectors/HybridApp';
import getCurrentUrl from '@libs/Navigation/currentUrl';
import {isAnonymousUser} from '@userActions/Session';
import CONFIG from '@src/CONFIG';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Account, Onboarding, Session} from '@src/types/onyx';
import type {GuardContext, GuardResult, NavigationGuard} from './types';
import OnboardingGuard from './OnboardingGuard';
import TwoFactorAuthGuard from './TwoFactorAuthGuard';

/**
 * Module-level Onyx subscriptions for guard context
 * These provide synchronous access to Onyx data during guard evaluation
 */
let account: OnyxEntry<Account>;
let onboarding: OnyxEntry<Onboarding>;
let session: OnyxEntry<Session>;
let isLoadingApp = true;
let isSingleNewDotEntry = false;

// Subscribe to account data
Onyx.connectWithoutView({
    key: ONYXKEYS.ACCOUNT,
    callback: (value) => {
        account = value;
    },
});

// Subscribe to onboarding data
Onyx.connectWithoutView({
    key: ONYXKEYS.NVP_ONBOARDING,
    callback: (value) => {
        onboarding = value;
    },
});

// Subscribe to session data
Onyx.connectWithoutView({
    key: ONYXKEYS.SESSION,
    callback: (value) => {
        session = value;
    },
});

// Subscribe to app loading state
Onyx.connectWithoutView({
    key: ONYXKEYS.IS_LOADING_APP,
    callback: (value) => {
        isLoadingApp = value ?? true;
    },
});

// Subscribe to HybridApp state (if applicable)
if (CONFIG.IS_HYBRID_APP) {
    Onyx.connectWithoutView({
        key: ONYXKEYS.HYBRID_APP,
        callback: (value) => {
            isSingleNewDotEntry = isSingleNewDotEntrySelector(value) ?? false;
        },
    });
}

/**
 * Registry of all navigation guards
 * Guards are stored in priority order (highest priority first)
 */
const guards: NavigationGuard[] = [];

/**
 * Registers a navigation guard
 *
 * Guards are automatically sorted by priority (highest first) after registration.
 *
 * @param guard - The guard to register
 *
 * @example
 * ```typescript
 * registerGuard({
 *   name: 'AuthGuard',
 *   priority: 100,
 *   shouldApply: (state, action, context) => !context.isAuthenticated,
 *   evaluate: (state, action, context) => ({ type: 'REDIRECT', route: ROUTES.SIGN_IN_MODAL })
 * });
 * ```
 */
function registerGuard(guard: NavigationGuard): void {
    guards.push(guard);
    // Sort guards by priority (highest first)
    guards.sort((a, b) => b.priority - a.priority);
}

/**
 * Creates a guard context snapshot with current Onyx data and computed flags
 *
 * This function provides a read-only snapshot of relevant application state
 * for guards to use in their evaluation logic.
 *
 * @returns Guard context with Onyx data and helper flags
 */
function createGuardContext(): GuardContext {
    const isAuthenticated = !!session?.authToken;
    const isAnonymous = isAnonymousUser();
    const currentUrl = getCurrentUrl();
    const isLoading = isLoadingApp;

    return {
        account,
        onboarding,
        session,
        isLoadingApp,
        isAuthenticated,
        isAnonymous,
        currentUrl,
        isSingleNewDotEntry,
        isLoading,
    };
}

/**
 * Evaluates all registered guards for the given navigation action
 *
 * Guards are evaluated in priority order (highest priority first).
 * Evaluation short-circuits on the first BLOCK or REDIRECT result.
 *
 * @param state - Current navigation state
 * @param action - Navigation action being attempted
 * @param context - Guard context (pass createGuardContext() result)
 * @returns Guard result (ALLOW, BLOCK, or REDIRECT)
 *
 * @example
 * ```typescript
 * const context = createGuardContext();
 * const result = evaluateGuards(state, action, context);
 *
 * if (result.type === 'BLOCK') {
 *   // Block navigation, return unchanged state
 *   return state;
 * }
 *
 * if (result.type === 'REDIRECT') {
 *   // Create redirect action and process it
 *   const redirectAction = createNavigateAction(result.route, result.params);
 *   return stackRouter.getStateForAction(state, redirectAction, configOptions);
 * }
 *
 * // result.type === 'ALLOW' - continue with normal navigation
 * ```
 */
function evaluateGuards(state: NavigationState, action: NavigationAction, context: GuardContext): GuardResult {
    // Evaluate guards in priority order
    for (const guard of guards) {
        // Check if guard applies to this navigation action
        if (!guard.shouldApply(state, action, context)) {
            continue;
        }

        // Evaluate the guard
        const result = guard.evaluate(state, action, context);

        // Short-circuit on BLOCK or REDIRECT
        if (result.type === 'BLOCK' || result.type === 'REDIRECT') {
            return result;
        }

        // Continue to next guard if ALLOW
    }

    // All guards passed or didn't apply - allow navigation
    return {type: 'ALLOW'};
}

/**
 * Gets all registered guards (for testing/debugging)
 *
 * @returns Array of registered guards in priority order
 */
function getRegisteredGuards(): ReadonlyArray<NavigationGuard> {
    return guards;
}

/**
 * Clears all registered guards (primarily for testing)
 */
function clearGuards(): void {
    guards.length = 0;
}

// Register guards (in priority order for clarity, though they're auto-sorted)
registerGuard(TwoFactorAuthGuard); // Priority 1000
registerGuard(OnboardingGuard); // Priority 500

export {registerGuard, createGuardContext, evaluateGuards, getRegisteredGuards, clearGuards};
export type {NavigationGuard, GuardResult, GuardContext};
