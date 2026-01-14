import {describe, expect, it, jest} from '@jest/globals';
import type {NavigationAction, NavigationState} from '@react-navigation/native';
import OnboardingGuard from '@libs/Navigation/guards/OnboardingGuard';
import type {GuardContext} from '@libs/Navigation/guards/types';
import CONST from '@src/CONST';
import NAVIGATORS from '@src/NAVIGATORS';
import ROUTES from '@src/ROUTES';
import type {Account, Onboarding} from '@src/types/onyx';

describe('OnboardingGuard', () => {
    const createMockState = (routes: Array<{name: string; key?: string}>): NavigationState => ({
        key: 'root',
        index: routes.length - 1,
        routeNames: routes.map((r) => r.name),
        routes: routes.map((r, i) => ({key: r.key ?? `route-${i}`, name: r.name})),
        stale: false,
        type: 'stack',
    });

    const createMockAction = (type: string, payload?: Record<string, unknown>): NavigationAction => ({
        type,
        ...(payload && {payload}),
    });

    const createMockContext = (overrides?: Partial<GuardContext>): GuardContext => ({
        account: undefined,
        onboarding: undefined,
        session: undefined,
        isLoadingApp: false,
        isAuthenticated: true,
        isAnonymous: false,
        currentUrl: '',
        isSingleNewDotEntry: false,
        isLoading: false,
        ...overrides,
    });

    describe('shouldApply', () => {
        it('should not apply when app is loading', () => {
            const state = createMockState([{name: 'Home'}]);
            const action = createMockAction('NAVIGATE');
            const context = createMockContext({isLoading: true});

            const result = OnboardingGuard.shouldApply(state, action, context);

            expect(result).toBe(false);
        });

        it('should not apply when isLoadingApp is true', () => {
            const state = createMockState([{name: 'Home'}]);
            const action = createMockAction('NAVIGATE');
            const context = createMockContext({isLoadingApp: true});

            const result = OnboardingGuard.shouldApply(state, action, context);

            expect(result).toBe(false);
        });

        it('should not apply when 2FA setup is required', () => {
            const state = createMockState([{name: 'Home'}]);
            const action = createMockAction('NAVIGATE');
            const account: Account = {
                needsTwoFactorAuthSetup: true,
                requiresTwoFactorAuth: false,
            } as Account;
            const context = createMockContext({account});

            const result = OnboardingGuard.shouldApply(state, action, context);

            expect(result).toBe(false);
        });

        it('should apply when 2FA is already set up', () => {
            const state = createMockState([{name: 'Home'}]);
            const action = createMockAction('NAVIGATE');
            const account: Account = {
                needsTwoFactorAuthSetup: true,
                requiresTwoFactorAuth: true,
            } as Account;
            const context = createMockContext({account});

            const result = OnboardingGuard.shouldApply(state, action, context);

            expect(result).toBe(true);
        });

        it('should not apply on transition route', () => {
            const state = createMockState([{name: 'Home'}]);
            const action = createMockAction('NAVIGATE');
            const context = createMockContext({currentUrl: ROUTES.TRANSITION_BETWEEN_APPS});

            const result = OnboardingGuard.shouldApply(state, action, context);

            expect(result).toBe(false);
        });

        it('should apply when all conditions are met', () => {
            const state = createMockState([{name: 'Home'}]);
            const action = createMockAction('NAVIGATE');
            const context = createMockContext();

            const result = OnboardingGuard.shouldApply(state, action, context);

            expect(result).toBe(true);
        });
    });

    describe('evaluate - Onboarding Not Completed', () => {
        it('should redirect to onboarding when not completed and not on onboarding screen', () => {
            const state = createMockState([{name: 'Home'}]);
            const action = createMockAction('NAVIGATE', {name: 'Settings'});
            const onboarding: Onboarding = {
                hasCompletedGuidedSetupFlow: false,
            } as Onboarding;
            const context = createMockContext({onboarding});

            const result = OnboardingGuard.evaluate(state, action, context);

            expect(result.type).toBe('REDIRECT');
            expect((result as {route?: string}).route).toContain('onboarding');
        });

        it('should allow navigation to onboarding when not completed', () => {
            const state = createMockState([{name: 'Home'}]);
            const action = createMockAction('NAVIGATE', {name: ROUTES.ONBOARDING_ROOT.route});
            const onboarding: Onboarding = {
                hasCompletedGuidedSetupFlow: false,
            } as Onboarding;
            const context = createMockContext({onboarding});

            const result = OnboardingGuard.evaluate(state, action, context);

            expect(result.type).toBe('ALLOW');
        });

        it('should allow navigation to onboarding personal details', () => {
            const state = createMockState([{name: 'Home'}]);
            const action = createMockAction('NAVIGATE', {name: ROUTES.ONBOARDING_PERSONAL_DETAILS.route});
            const onboarding: Onboarding = {
                hasCompletedGuidedSetupFlow: false,
            } as Onboarding;
            const context = createMockContext({onboarding});

            const result = OnboardingGuard.evaluate(state, action, context);

            expect(result.type).toBe('ALLOW');
        });

        it('should block navigation away from onboarding when incomplete', () => {
            const state = createMockState([{name: NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR}]);
            const action = createMockAction(CONST.NAVIGATION_ACTIONS.RESET, {
                index: 0,
                routes: [{name: 'Home'}],
            });
            const onboarding: Onboarding = {
                hasCompletedGuidedSetupFlow: false,
            } as Onboarding;
            const context = createMockContext({onboarding});

            const result = OnboardingGuard.evaluate(state, action, context);

            expect(result.type).toBe('BLOCK');
            expect((result as {reason?: string}).reason).toBeDefined();
        });

        it('should allow navigation within onboarding screens', () => {
            const state = createMockState([{name: NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR}]);
            const action = createMockAction('NAVIGATE', {name: NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR});
            const onboarding: Onboarding = {
                hasCompletedGuidedSetupFlow: false,
            } as Onboarding;
            const context = createMockContext({onboarding});

            const result = OnboardingGuard.evaluate(state, action, context);

            expect(result.type).toBe('ALLOW');
        });

        it('should block navigation to non-onboarding screen when on onboarding', () => {
            const state = createMockState([{name: NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR}]);
            const action = createMockAction('NAVIGATE', {name: 'Settings'});
            const onboarding: Onboarding = {
                hasCompletedGuidedSetupFlow: false,
            } as Onboarding;
            const context = createMockContext({onboarding});

            const result = OnboardingGuard.evaluate(state, action, context);

            expect(result.type).toBe('BLOCK');
        });
    });

    describe('evaluate - Test Drive Modal', () => {
        it('should redirect to test drive modal when onboarding complete and modal not dismissed', () => {
            const state = createMockState([{name: 'Home'}]);
            const action = createMockAction('NAVIGATE', {name: 'Settings'});
            const onboarding: Onboarding = {
                hasCompletedGuidedSetupFlow: true,
                testDriveModalDismissed: false,
            } as Onboarding;
            const context = createMockContext({onboarding});

            const result = OnboardingGuard.evaluate(state, action, context);

            expect(result.type).toBe('REDIRECT');
            expect((result as {route?: string}).route).toBe(ROUTES.TEST_DRIVE_MODAL_ROOT.route);
        });

        it('should allow navigation when already on test drive modal', () => {
            const state = createMockState([{name: NAVIGATORS.TEST_DRIVE_MODAL_NAVIGATOR}]);
            const action = createMockAction('NAVIGATE', {name: 'TestDriveScreen'});
            const onboarding: Onboarding = {
                hasCompletedGuidedSetupFlow: true,
                testDriveModalDismissed: false,
            } as Onboarding;
            const context = createMockContext({onboarding});

            const result = OnboardingGuard.evaluate(state, action, context);

            expect(result.type).toBe('ALLOW');
        });

        it('should allow navigation to test drive modal when navigating to onboarding route', () => {
            const state = createMockState([{name: 'Home'}]);
            const action = createMockAction('NAVIGATE', {name: ROUTES.TEST_DRIVE_MODAL_ROOT.route});
            const onboarding: Onboarding = {
                hasCompletedGuidedSetupFlow: true,
                testDriveModalDismissed: false,
            } as Onboarding;
            const context = createMockContext({onboarding});

            const result = OnboardingGuard.evaluate(state, action, context);

            expect(result.type).toBe('ALLOW');
        });

        it('should not redirect to test drive modal when testDriveModalDismissed is true', () => {
            const state = createMockState([{name: 'Home'}]);
            const action = createMockAction('NAVIGATE', {name: 'Settings'});
            const onboarding: Onboarding = {
                hasCompletedGuidedSetupFlow: true,
                testDriveModalDismissed: true,
            } as Onboarding;
            const context = createMockContext({onboarding});

            const result = OnboardingGuard.evaluate(state, action, context);

            expect(result.type).toBe('ALLOW');
        });

        it('should not redirect to test drive modal when testDriveModalDismissed is undefined', () => {
            const state = createMockState([{name: 'Home'}]);
            const action = createMockAction('NAVIGATE', {name: 'Settings'});
            const onboarding: Onboarding = {
                hasCompletedGuidedSetupFlow: true,
                testDriveModalDismissed: undefined,
            } as Onboarding;
            const context = createMockContext({onboarding});

            const result = OnboardingGuard.evaluate(state, action, context);

            expect(result.type).toBe('ALLOW');
        });
    });

    describe('evaluate - Onboarding Complete', () => {
        it('should allow all navigation when onboarding complete and test drive modal dismissed', () => {
            const state = createMockState([{name: 'Home'}]);
            const action = createMockAction('NAVIGATE', {name: 'Settings'});
            const onboarding: Onboarding = {
                hasCompletedGuidedSetupFlow: true,
                testDriveModalDismissed: true,
            } as Onboarding;
            const context = createMockContext({onboarding});

            const result = OnboardingGuard.evaluate(state, action, context);

            expect(result.type).toBe('ALLOW');
        });

        it('should allow navigation when onboarding is undefined (completed)', () => {
            const state = createMockState([{name: 'Home'}]);
            const action = createMockAction('NAVIGATE', {name: 'Settings'});
            const context = createMockContext({onboarding: undefined});

            const result = OnboardingGuard.evaluate(state, action, context);

            expect(result.type).toBe('ALLOW');
        });
    });

    it('should check onboarding completion before test drive modal', () => {
        const state = createMockState([{name: 'Home'}]);
        const action = createMockAction('NAVIGATE', {name: 'Settings'});
        const onboarding: Onboarding = {
            hasCompletedGuidedSetupFlow: false,
            testDriveModalDismissed: false,
        } as Onboarding;
        const context = createMockContext({onboarding});

        const result = OnboardingGuard.evaluate(state, action, context);

        // Should redirect to onboarding, not test drive modal
        expect(result.type).toBe('REDIRECT');
        expect((result as {route?: string}).route).not.toBe(ROUTES.TEST_DRIVE_MODAL_ROOT.route);
    });

    it('should handle RESET action correctly', () => {
        const state = createMockState([{name: NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR}]);
        const action = createMockAction(CONST.NAVIGATION_ACTIONS.RESET, {
            index: 0,
            routes: [{name: NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR}],
        });
        const onboarding: Onboarding = {
            hasCompletedGuidedSetupFlow: false,
        } as Onboarding;
        const context = createMockContext({onboarding});

        const result = OnboardingGuard.evaluate(state, action, context);

        expect(result.type).toBe('ALLOW');
    });
});
