import type {NavigationAction, NavigationState} from '@react-navigation/native';
import type {OnyxEntry} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import CONST from '@src/CONST';
import type {Route} from '@src/ROUTES';
import type {Account, Onboarding, Session} from '@src/types/onyx';

type OnboardingPurpose = ValueOf<typeof CONST.ONBOARDING_CHOICES>;
type OnboardingCompanySize = ValueOf<typeof CONST.ONBOARDING_COMPANY_SIZE>;

/**
 * Result of a navigation guard evaluation
 */
type GuardResult =
    /**
     * Allow the navigation to proceed
     */
    | {type: 'ALLOW'}
    /**
     * Block the navigation (return unchanged state)
     */
    | {type: 'BLOCK'; reason?: string}
    /**
     * Redirect to a different route
     */
    | {type: 'REDIRECT'; route: Route; params?: Record<string, unknown>};

/**
 * Context provided to navigation guards for evaluation
 * Contains read-only snapshots of relevant Onyx data and computed flags
 */
type GuardContext = {
    /** Account data from Onyx */
    account: OnyxEntry<Account>;

    /** Onboarding status data from Onyx */
    onboarding: OnyxEntry<Onboarding>;

    /** Session data from Onyx */
    session: OnyxEntry<Session>;

    /** Whether the app is currently loading */
    isLoadingApp: boolean;

    /** Whether the user is authenticated */
    isAuthenticated: boolean;

    /** Whether the user is anonymous */
    isAnonymous: boolean;

    /** Current URL (for HybridApp and deep link checks) */
    currentUrl: string;

    /** Whether this is a single NewDot entry from OldDot (HybridApp) */
    isSingleNewDotEntry: boolean;

    /** Whether data is still loading */
    isLoading: boolean;

    /** Currently selected onboarding purpose from Onyx */
    onboardingPurposeSelected: OnyxEntry<OnboardingPurpose>;

    /** Currently selected onboarding company size from Onyx */
    onboardingCompanySize: OnyxEntry<OnboardingCompanySize>;

    /** Last visited path during onboarding from Onyx */
    onboardingLastVisitedPath: OnyxEntry<string>;
};

/**
 * Navigation guard interface
 *
 * Guards intercept navigation actions and can:
 * - Allow navigation to proceed (ALLOW)
 * - Block navigation entirely (BLOCK)
 * - Redirect to a different route (REDIRECT)
 *
 * Guards are evaluated in registration order.
 * The first guard to return BLOCK or REDIRECT short-circuits evaluation.
 *
 * @example
 * ```typescript
 * const MyGuard: NavigationGuard = {
 *   name: 'MyGuard',
 *
 *   shouldApply(state, action, context) {
 *     // Return true if this guard should evaluate for this navigation
 *     return !context.isAuthenticated;
 *   },
 *
 *   evaluate(state, action, context) {
 *     // Return ALLOW, BLOCK, or REDIRECT
 *     return { type: 'REDIRECT', route: ROUTES.SIGN_IN_MODAL };
 *   }
 * };
 * ```
 */
interface NavigationGuard {
    /** Guard name for debugging and logging */
    name: string;

    /**
     * Determines if this guard should evaluate for the given navigation action
     *
     * This is called before evaluate() to allow guards to skip evaluation
     * when they don't apply to the current navigation attempt.
     *
     * @param state - Current navigation state
     * @param action - Navigation action being attempted
     * @param context - Guard context with Onyx data and computed flags
     * @returns true if evaluate() should be called, false to skip this guard
     */
    shouldApply(state: NavigationState, action: NavigationAction, context: GuardContext): boolean;

    /**
     * Evaluates the navigation action and returns a decision
     *
     * This is only called if shouldApply() returns true.
     *
     * @param state - Current navigation state
     * @param action - Navigation action being attempted
     * @param context - Guard context with Onyx data and computed flags
     * @returns Guard decision (ALLOW, BLOCK, or REDIRECT)
     */
    evaluate(state: NavigationState, action: NavigationAction, context: GuardContext): GuardResult;
}

export type {GuardResult, GuardContext, NavigationGuard};
