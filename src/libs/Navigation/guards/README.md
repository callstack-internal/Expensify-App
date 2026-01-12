# Navigation Guard System

This directory contains the centralized navigation guard system that intercepts all navigation actions and can allow, block, or redirect them based on application state.

## Overview

The guard system provides a single architectural point for handling all navigation redirects in the application. Guards are evaluated in priority order before any navigation state changes occur, making navigation behavior predictable and testable.

### Key Benefits

- **Single source of truth**: All redirect logic in one place
- **No hidden side effects**: Guards explicitly control navigation
- **Testable**: Guards can be unit tested in isolation
- **Predictable**: Priority-based execution with clear short-circuit behavior
- **Extensible**: Easy to add new guard types for auth, permissions, etc.

## Architecture

```
User attempts navigation
    ↓
RootStackRouter.getStateForAction()
    ↓
evaluateGuards(state, action, context)
    ↓
For each guard (by priority):
    - shouldApply(state, action, context)  // Should this guard evaluate?
    - evaluate(state, action, context)     // Returns ALLOW | BLOCK | REDIRECT
    ↓
First BLOCK or REDIRECT short-circuits evaluation
    ↓
Handle result:
    - ALLOW → Continue with navigation
    - BLOCK → Return unchanged state (no navigation)
    - REDIRECT → Create redirect action and process it
```

## Files

- **`types.ts`** - TypeScript interfaces and types for the guard system
- **`index.ts`** - Guard registry, evaluator, and Onyx context management
- **`OnboardingGuard.ts`** - Handles onboarding flow redirects
- **`TwoFactorAuthGuard.ts`** - Handles 2FA requirement redirects

## Guard Types

### GuardResult

Guards return one of three result types:

```typescript
type GuardResult =
  | { type: 'ALLOW' }                          // Allow navigation to proceed
  | { type: 'BLOCK', reason?: string }         // Block navigation entirely
  | { type: 'REDIRECT', route: Route, params?: object }; // Redirect to different route
```

### GuardContext

Guards receive a context object with application state:

```typescript
type GuardContext = {
  account: OnyxEntry<Account>;
  onboarding: OnyxEntry<Onboarding>;
  session: OnyxEntry<Session>;
  isLoadingApp: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  currentUrl: string;
  isSingleNewDotEntry: boolean;  // HybridApp specific
  isLoading: boolean;
};
```

The context is created once per navigation attempt using synchronous Onyx data snapshots (no async overhead).

## Creating a New Guard

### 1. Create the Guard File

```typescript
// src/libs/Navigation/guards/AuthenticationGuard.ts
import type {NavigationAction, NavigationState} from '@react-navigation/native';
import Log from '@libs/Log';
import ROUTES from '@src/ROUTES';
import type {GuardContext, GuardResult, NavigationGuard} from './types';

/**
 * Authentication Guard
 *
 * Redirects unauthenticated users to sign-in when they attempt
 * to access protected routes.
 *
 * Priority: 100 (Authentication and authorization)
 */
const AuthenticationGuard: NavigationGuard = {
  name: 'AuthenticationGuard',
  priority: 100,

  shouldApply(state: NavigationState, action: NavigationAction, context: GuardContext): boolean {
    // Only apply if user is not authenticated
    if (context.isAuthenticated) {
      return false;
    }

    // Only apply if navigating to a protected route
    // (implement your route checking logic here)
    return true;
  },

  evaluate(state: NavigationState, action: NavigationAction, context: GuardContext): GuardResult {
    Log.info('[AuthenticationGuard] Redirecting to sign-in');

    return {
      type: 'REDIRECT',
      route: ROUTES.SIGN_IN_MODAL,
    };
  },
};

export default AuthenticationGuard;
```

### 2. Register the Guard

Add your guard to `src/libs/Navigation/guards/index.ts`:

```typescript
import AuthenticationGuard from './AuthenticationGuard';

// ... existing code ...

// Register guards (in priority order for clarity)
registerGuard(TwoFactorAuthGuard);      // Priority 1000
registerGuard(OnboardingGuard);         // Priority 500
registerGuard(AuthenticationGuard);     // Priority 100  ← Add your guard
```

That's it! The guard will automatically be evaluated for all navigation attempts.

## Guard Priority Guidelines

Guards are evaluated in priority order (highest first). Use these guidelines:

- **1000+**: Critical system guards (2FA, account issues, system-wide blocks)
- **500-999**: Onboarding and setup flows
- **100-499**: Authentication and authorization
- **50-99**: Feature-specific permissions (workspace access, etc.)
- **1-49**: Fallback and default behaviors

## Best Practices

### Do's

✅ **Keep guards focused**: Each guard should handle one specific concern
✅ **Return early**: Use `shouldApply()` to skip evaluation when guard doesn't apply
✅ **Log decisions**: Add logging for debugging and monitoring
✅ **Write tests**: Guards should be unit tested in isolation
✅ **Use pure functions**: Guards should be side-effect free (except logging)

### Don'ts

❌ **Don't perform async operations**: Guards use synchronous Onyx data snapshots
❌ **Don't modify application state**: Guards should only read context
❌ **Don't create circular redirects**: Ensure redirect targets won't trigger the same guard
❌ **Don't duplicate logic**: If two guards need similar checks, extract a helper function

## Common Patterns

### Conditional Redirection

```typescript
evaluate(state, action, context) {
  if (!context.isAuthenticated) {
    return { type: 'REDIRECT', route: ROUTES.SIGN_IN_MODAL };
  }

  if (someOtherCondition) {
    return { type: 'REDIRECT', route: ROUTES.OTHER_SCREEN };
  }

  return { type: 'ALLOW' };
}
```

### Blocking with Reason

```typescript
evaluate(state, action, context) {
  if (someBlockingCondition) {
    return {
      type: 'BLOCK',
      reason: 'User must complete onboarding first',
    };
  }

  return { type: 'ALLOW' };
}
```

### Checking Navigation Target

```typescript
import {getActionFromState} from '@react-navigation/native';

function getTargetRoute(action: NavigationAction): string | undefined {
  if ('payload' in action && action.payload && typeof action.payload === 'object') {
    const payload = action.payload as Record<string, unknown>;
    if ('name' in payload && typeof payload.name === 'string') {
      return payload.name;
    }
  }
  return undefined;
}

shouldApply(state, action, context) {
  const targetRoute = getTargetRoute(action);
  return targetRoute === ROUTES.SOME_PROTECTED_SCREEN;
}
```

## Testing Guards

Guards can be tested in isolation by mocking the context:

```typescript
import OnboardingGuard from '../OnboardingGuard';
import type {GuardContext} from '../types';

describe('OnboardingGuard', () => {
  const mockState = { /* mock navigation state */ };
  const mockAction = { /* mock navigation action */ };

  it('should redirect when onboarding is incomplete', () => {
    const context: GuardContext = {
      onboarding: { hasCompletedGuidedSetupFlow: false },
      account: {},
      isAuthenticated: true,
      isLoading: false,
      // ... other context fields
    };

    const result = OnboardingGuard.evaluate(mockState, mockAction, context);

    expect(result.type).toBe('REDIRECT');
    expect(result.route).toContain('onboarding');
  });

  it('should allow when onboarding is complete', () => {
    const context: GuardContext = {
      onboarding: { hasCompletedGuidedSetupFlow: true, testDriveModalDismissed: true },
      account: {},
      isAuthenticated: true,
      isLoading: false,
      // ... other context fields
    };

    const result = OnboardingGuard.evaluate(mockState, mockAction, context);

    expect(result.type).toBe('ALLOW');
  });
});
```

## Debugging

### Enable Guard Logging

Guards log their decisions at the `info` level:

```
[TwoFactorAuthGuard] Blocked navigation to /settings because 2FA setup is required
[OnboardingGuard] Redirecting to onboarding: /onboarding/purpose
```

### Inspect Registered Guards

You can inspect all registered guards:

```typescript
import {getRegisteredGuards} from '@libs/Navigation/guards';

console.log(getRegisteredGuards());
// Returns array of guards sorted by priority
```

### Clear Guards (Testing Only)

For testing purposes, you can clear all guards:

```typescript
import {clearGuards} from '@libs/Navigation/guards';

clearGuards(); // Removes all registered guards
```

## Migration from Old Patterns

### Before (Hidden Side Effects)

```typescript
// ❌ Bad: Navigation side effects hidden in callbacks
isOnboardingFlowCompleted({
  onNotCompleted: () => startOnboardingFlow({...}),
  onCompleted: handleNavigation,
});
```

### After (Guard System)

```typescript
// ✅ Good: Guard handles redirect automatically
handleNavigation(); // OnboardingGuard will intercept if needed
```

The guard system intercepts the navigation attempt and redirects to onboarding if needed. No callbacks required!

## Future Extensions

The guard system is designed to handle all redirect scenarios:

- **Authentication**: Sign-in redirects for unauthenticated users
- **Permissions**: Access control for workspace routes
- **Feature flags**: Block navigation to disabled features
- **Error states**: Handle API errors requiring user action
- **Network status**: Prevent navigation when offline
- **Paywalls**: Redirect free users trying to access premium features

Simply create a new guard following the patterns above and register it with the appropriate priority.

## Performance

The guard system is designed for minimal performance impact:

- **Synchronous evaluation**: No async operations or promises
- **Early exit**: `shouldApply()` allows guards to skip evaluation quickly
- **Priority ordering**: Most common guards can run first
- **Single context creation**: Context created once per navigation attempt
- **No re-renders**: Guards don't cause React re-renders

## Support

For questions or issues with the guard system:

1. Check the existing guards (OnboardingGuard, TwoFactorAuthGuard) for examples
2. Review this README for patterns and best practices
3. Ask in the #expensify-open-source Slack channel
4. Create an issue in the GitHub repository

---

**Last Updated**: 2026-01-12
**System Version**: 1.0.0
