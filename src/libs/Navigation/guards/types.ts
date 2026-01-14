import type {NavigationAction, NavigationState} from '@react-navigation/native';
import type {OnyxEntry} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import CONST from '@src/CONST';
import type {Route} from '@src/ROUTES';
import type {Account, Onboarding, Session} from '@src/types/onyx';

type OnboardingPurpose = ValueOf<typeof CONST.ONBOARDING_CHOICES>;
type OnboardingCompanySize = ValueOf<typeof CONST.ONBOARDING_COMPANY_SIZE>;

type GuardResult = {type: 'ALLOW'} | {type: 'BLOCK'; reason?: string} | {type: 'REDIRECT'; route: Route; params?: Record<string, unknown>};

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

    /** Whether HybridApp onboarding (explanation modal) has been completed */
    isHybridAppOnboardingCompleted: boolean | undefined;

    /** Whether user has been added to nudge migration cohort */
    hasBeenAddedToNudgeMigration: boolean;
};
interface NavigationGuard {
    /** Guard name for debugging and logging */
    name: string;

    /**
     * Determines if this guard should evaluate for the given navigation action
     */
    shouldApply(state: NavigationState, action: NavigationAction, context: GuardContext): boolean;

    /**
     * Evaluates the navigation action and returns a decision
     */
    evaluate(state: NavigationState, action: NavigationAction, context: GuardContext): GuardResult;
}

export type {GuardResult, GuardContext, NavigationGuard};
