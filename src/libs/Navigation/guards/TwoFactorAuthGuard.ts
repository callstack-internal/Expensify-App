import type {NavigationAction, NavigationState} from '@react-navigation/native';
import type {OnyxEntry} from 'react-native-onyx';
import Log from '@libs/Log';
import ROUTES from '@src/ROUTES';
import type {Account} from '@src/types/onyx';
import type {GuardContext, GuardResult, NavigationGuard} from './types';

// Routes which are part of the flow to set up 2FA
const SET_UP_2FA_ROUTES = new Set([
    ROUTES.REQUIRE_TWO_FACTOR_AUTH,
    ROUTES.SETTINGS_2FA_ROOT.getRoute(ROUTES.REQUIRE_TWO_FACTOR_AUTH),
    ROUTES.SETTINGS_2FA_VERIFY.getRoute(ROUTES.REQUIRE_TWO_FACTOR_AUTH),
    ROUTES.SETTINGS_2FA_SUCCESS.getRoute(ROUTES.REQUIRE_TWO_FACTOR_AUTH),
    ROUTES.SETTINGS_2FA_VERIFY_ACCOUNT.getRoute({backTo: ROUTES.REQUIRE_TWO_FACTOR_AUTH}),
]);

/**
 * Checks if 2FA setup is required
 */
function shouldShowRequire2FAPage(account: OnyxEntry<Account>): boolean {
    return !!account?.needsTwoFactorAuthSetup && !account?.requiresTwoFactorAuth;
}

/**
 * Extracts the target route from a navigation action
 */
function getTargetRouteFromAction(state: NavigationState, action: NavigationAction): string | undefined {
    try {
        // Try to get the route from the action
        if ('payload' in action && action.payload && typeof action.payload === 'object') {
            const payload = action.payload as Record<string, unknown>;

            // Check for route name in payload
            if ('name' in payload && typeof payload.name === 'string') {
                return payload.name;
            }

            // Check for path in payload
            if ('path' in payload && typeof payload.path === 'string') {
                return payload.path;
            }
        }

        // If we can't extract from action, try to determine from state
        // This is a fallback for actions that don't have clear route information
        return undefined;
    } catch (error) {
        Log.warn('[TwoFactorAuthGuard] Error extracting target route from action', {error});
        return undefined;
    }
}

/**
 * Two-Factor Authentication Guard
 *
 * Prevents navigation when 2FA setup is required, except to routes
 * that are part of the 2FA setup flow.
 *
 * Priority: 1000 (Critical - must run before other guards)
 */
const TwoFactorAuthGuard: NavigationGuard = {
    name: 'TwoFactorAuthGuard',
    priority: 1000,

    shouldApply(state: NavigationState, action: NavigationAction, context: GuardContext): boolean {
        // Only apply if 2FA setup is required
        return shouldShowRequire2FAPage(context.account);
    },

    evaluate(state: NavigationState, action: NavigationAction, context: GuardContext): GuardResult {
        const targetRoute = getTargetRouteFromAction(state, action);

        // If we can't determine the target route, allow (fail open for safety)
        if (!targetRoute) {
            return {type: 'ALLOW'};
        }

        // Allow navigation to 2FA setup routes
        // Check if the target route is in the SET_UP_2FA_ROUTES set or starts with any of them
        const is2FARoute = Array.from(SET_UP_2FA_ROUTES).some(
            (route) => targetRoute === route || targetRoute.startsWith(route),
        );

        if (is2FARoute) {
            return {type: 'ALLOW'};
        }

        // Block all other navigation
        Log.info(`[TwoFactorAuthGuard] Blocked navigation to ${targetRoute} because 2FA setup is required`);
        return {
            type: 'BLOCK',
            reason: '2FA setup required',
        };
    },
};

export default TwoFactorAuthGuard;
