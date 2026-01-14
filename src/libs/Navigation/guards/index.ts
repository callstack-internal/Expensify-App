import type {NavigationAction, NavigationState} from '@react-navigation/native';
import {isSingleNewDotEntrySelector} from '@selectors/HybridApp';
import Onyx from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import getCurrentUrl from '@libs/Navigation/currentUrl';
import {isAnonymousUser} from '@userActions/Session';
import CONFIG from '@src/CONFIG';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Session} from '@src/types/onyx';
import OnboardingGuard from './OnboardingGuard';
import type {GuardContext, GuardResult, NavigationGuard} from './types';

/**
 * Module-level Onyx subscriptions for common guard context values
 * These provide synchronous access to shared data used by multiple guards
 */
let session: OnyxEntry<Session>;
let isLoadingApp = true;
let isSingleNewDotEntry = false;
Onyx.connectWithoutView({
    key: ONYXKEYS.SESSION,
    callback: (value) => {
        session = value;
    },
});

Onyx.connectWithoutView({
    key: ONYXKEYS.IS_LOADING_APP,
    callback: (value) => {
        isLoadingApp = value ?? true;
    },
});

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
 * Guards are evaluated in the order they are registered
 */
const guards: NavigationGuard[] = [];

/**
 * Registers a navigation guard
 */
function registerGuard(guard: NavigationGuard): void {
    guards.push(guard);
}

/**
 * Creates a guard context with common computed values
 * Guards access specific Onyx data directly via their own subscriptions
 *
 * @returns Guard context with common helper flags
 */
function createGuardContext(): GuardContext {
    const isAuthenticated = !!session?.authToken;
    const isAnonymous = isAnonymousUser();
    const currentUrl = getCurrentUrl();
    const isLoading = isLoadingApp;

    return {
        isAuthenticated,
        isAnonymous,
        currentUrl,
        isSingleNewDotEntry,
        isLoading,
    };
}

/**
 * Evaluates all registered guards for the given navigation action
 * Evaluation short-circuits on the first BLOCK or REDIRECT result.
 *
 * BLOCK - block navigation, return unchanged state
 * REDIRECT - create redirect action and process it
 * ALLOW - continue with normal navigation
 */
function evaluateGuards(state: NavigationState, action: NavigationAction, context: GuardContext): GuardResult {
    for (const guard of guards) {
        if (!guard.shouldApply(state, action, context)) {
            continue;
        }

        const result = guard.evaluate(state, action, context);

        if (result.type === 'BLOCK' || result.type === 'REDIRECT') {
            return result;
        }
    }

    return {type: 'ALLOW'};
}

/**
 * Gets all registered guards
 */
function getRegisteredGuards(): ReadonlyArray<NavigationGuard> {
    return guards;
}

/**
 * Clears all registered guards
 */
function clearGuards(): void {
    guards.length = 0;
}

// Register guards in order of evaluation
// IMPORTANT: Order matters! Register critical guards first
registerGuard(OnboardingGuard);

export {registerGuard, createGuardContext, evaluateGuards, getRegisteredGuards, clearGuards};
export type {NavigationGuard, GuardResult, GuardContext};
