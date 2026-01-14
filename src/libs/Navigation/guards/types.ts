import type {NavigationAction, NavigationState} from '@react-navigation/native';
import type {Route} from '@src/ROUTES';

type GuardResult = {type: 'ALLOW'} | {type: 'BLOCK'; reason?: string} | {type: 'REDIRECT'; route: Route; params?: Record<string, unknown>};

type GuardContext = {
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
