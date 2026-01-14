import type {NavigationAction, NavigationState} from '@react-navigation/native';
import {isSingleNewDotEntrySelector} from '@selectors/HybridApp';
import Onyx from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import getCurrentUrl from '@libs/Navigation/currentUrl';
import {isAnonymousUser} from '@userActions/Session';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Account, Onboarding, Session} from '@src/types/onyx';
import OnboardingGuard from './OnboardingGuard';
import type {GuardContext, GuardResult, NavigationGuard} from './types';

type OnboardingPurpose = ValueOf<typeof CONST.ONBOARDING_CHOICES>;
type OnboardingCompanySize = ValueOf<typeof CONST.ONBOARDING_COMPANY_SIZE>;

/**
 * Module-level Onyx subscriptions for guard context
 * These provide synchronous access to Onyx data during guard evaluation
 */
let account: OnyxEntry<Account>;
let onboarding: OnyxEntry<Onboarding>;
let session: OnyxEntry<Session>;
let isLoadingApp = true;
let isSingleNewDotEntry = false;
let onboardingPurposeSelected: OnyxEntry<OnboardingPurpose>;
let onboardingCompanySize: OnyxEntry<OnboardingCompanySize>;
let onboardingLastVisitedPath: OnyxEntry<string>;

Onyx.connectWithoutView({
    key: ONYXKEYS.ACCOUNT,
    callback: (value) => {
        account = value;
    },
});

Onyx.connectWithoutView({
    key: ONYXKEYS.NVP_ONBOARDING,
    callback: (value) => {
        onboarding = value;
    },
});

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

Onyx.connectWithoutView({
    key: ONYXKEYS.ONBOARDING_PURPOSE_SELECTED,
    callback: (value) => {
        onboardingPurposeSelected = value;
    },
});

Onyx.connectWithoutView({
    key: ONYXKEYS.ONBOARDING_COMPANY_SIZE,
    callback: (value) => {
        onboardingCompanySize = value;
    },
});

Onyx.connectWithoutView({
    key: ONYXKEYS.ONBOARDING_LAST_VISITED_PATH,
    callback: (value) => {
        onboardingLastVisitedPath = value;
    },
});

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
 * Creates a guard context with current Onyx data and computed flags
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
        onboardingPurposeSelected,
        onboardingCompanySize,
        onboardingLastVisitedPath,
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
