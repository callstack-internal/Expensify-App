import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import type {NavigationAction, NavigationState} from '@react-navigation/native';
import * as Guards from '@libs/Navigation/guards';
import type {GuardContext, GuardResult, NavigationGuard} from '@libs/Navigation/guards/types';
import type {Route} from '@src/ROUTES';

describe('Navigation Guards System', () => {
    beforeEach(() => {
        // Clear any registered guards before each test
        Guards.clearGuards();
    });

    describe('registerGuard', () => {
        it('should register a guard successfully', () => {
            const mockGuard: NavigationGuard = {
                name: 'TestGuard',
                shouldApply: () => true,
                evaluate: () => ({type: 'ALLOW'}),
            };

            Guards.registerGuard(mockGuard);
            const registeredGuards = Guards.getRegisteredGuards();

            expect(registeredGuards).toHaveLength(1);
            expect(registeredGuards[0]).toBe(mockGuard);
        });

        it('should register multiple guards in order', () => {
            const guard1: NavigationGuard = {
                name: 'Guard1',
                shouldApply: () => true,
                evaluate: () => ({type: 'ALLOW'}),
            };
            const guard2: NavigationGuard = {
                name: 'Guard2',
                shouldApply: () => true,
                evaluate: () => ({type: 'ALLOW'}),
            };

            Guards.registerGuard(guard1);
            Guards.registerGuard(guard2);
            const registeredGuards = Guards.getRegisteredGuards();

            expect(registeredGuards).toHaveLength(2);
            expect(registeredGuards[0]).toBe(guard1);
            expect(registeredGuards[1]).toBe(guard2);
        });
    });

    describe('createGuardContext', () => {
        it('should create a guard context with required properties', () => {
            const context = Guards.createGuardContext();

            expect(context).toHaveProperty('account');
            expect(context).toHaveProperty('onboarding');
            expect(context).toHaveProperty('session');
            expect(context).toHaveProperty('isLoadingApp');
            expect(context).toHaveProperty('isAuthenticated');
            expect(context).toHaveProperty('isAnonymous');
            expect(context).toHaveProperty('currentUrl');
            expect(context).toHaveProperty('isSingleNewDotEntry');
            expect(context).toHaveProperty('isLoading');
        });
    });

    describe('evaluateGuards', () => {
        const mockState: NavigationState = {
            key: 'test',
            index: 0,
            routeNames: ['Home'],
            routes: [{key: 'home', name: 'Home'}],
            stale: false,
            type: 'test',
        };

        const mockAction: NavigationAction = {
            type: 'NAVIGATE',
            payload: {name: 'Test'},
        };

        const mockContext: GuardContext = {
            account: undefined,
            onboarding: undefined,
            session: undefined,
            isLoadingApp: false,
            isAuthenticated: false,
            isAnonymous: true,
            currentUrl: '',
            isSingleNewDotEntry: false,
            isLoading: false,
            onboardingPurposeSelected: undefined,
            onboardingCompanySize: undefined,
            onboardingLastVisitedPath: undefined,
            isHybridAppOnboardingCompleted: undefined,
            hasBeenAddedToNudgeMigration: false,
        };

        it('should return ALLOW when no guards are registered', () => {
            const result = Guards.evaluateGuards(mockState, mockAction, mockContext);

            expect(result.type).toBe('ALLOW');
        });

        it('should return ALLOW when guard does not apply', () => {
            const guard: NavigationGuard = {
                name: 'TestGuard',
                shouldApply: () => false,
                evaluate: jest.fn<(state: NavigationState, action: NavigationAction, context: GuardContext) => GuardResult>(() => ({type: 'BLOCK'})),
            };

            Guards.registerGuard(guard);
            const result = Guards.evaluateGuards(mockState, mockAction, mockContext);

            expect(result.type).toBe('ALLOW');
            expect(guard.evaluate).not.toHaveBeenCalled();
        });

        it('should evaluate guard when shouldApply returns true', () => {
            const guard: NavigationGuard = {
                name: 'TestGuard',
                shouldApply: () => true,
                evaluate: jest.fn<(state: NavigationState, action: NavigationAction, context: GuardContext) => GuardResult>(() => ({type: 'ALLOW'})),
            };

            Guards.registerGuard(guard);
            Guards.evaluateGuards(mockState, mockAction, mockContext);

            expect(guard.evaluate).toHaveBeenCalledWith(mockState, mockAction, mockContext);
        });

        it('should return BLOCK result from guard', () => {
            const guard: NavigationGuard = {
                name: 'TestGuard',
                shouldApply: () => true,
                evaluate: () => ({type: 'BLOCK', reason: 'Test reason'}),
            };

            Guards.registerGuard(guard);
            const result = Guards.evaluateGuards(mockState, mockAction, mockContext);

            expect(result.type).toBe('BLOCK');
            expect((result as {reason?: string}).reason).toBe('Test reason');
        });

        it('should return REDIRECT result from guard', () => {
            const guard: NavigationGuard = {
                name: 'TestGuard',
                shouldApply: () => true,
                evaluate: () => ({type: 'REDIRECT', route: '/test-route' as Route}),
            };

            Guards.registerGuard(guard);
            const result = Guards.evaluateGuards(mockState, mockAction, mockContext);

            expect(result.type).toBe('REDIRECT');
            expect((result as {route?: string}).route).toBe('/test-route');
        });

        it('should short-circuit on first BLOCK result', () => {
            const guard1: NavigationGuard = {
                name: 'Guard1',
                shouldApply: () => true,
                evaluate: () => ({type: 'BLOCK'}),
            };
            const guard2: NavigationGuard = {
                name: 'Guard2',
                shouldApply: () => true,
                evaluate: jest.fn<(state: NavigationState, action: NavigationAction, context: GuardContext) => GuardResult>(() => ({type: 'ALLOW'})),
            };

            Guards.registerGuard(guard1);
            Guards.registerGuard(guard2);
            const result = Guards.evaluateGuards(mockState, mockAction, mockContext);

            expect(result.type).toBe('BLOCK');
            expect(guard2.evaluate).not.toHaveBeenCalled();
        });

        it('should short-circuit on first REDIRECT result', () => {
            const guard1: NavigationGuard = {
                name: 'Guard1',
                shouldApply: () => true,
                evaluate: () => ({type: 'REDIRECT', route: '/redirect' as Route}),
            };
            const guard2: NavigationGuard = {
                name: 'Guard2',
                shouldApply: () => true,
                evaluate: jest.fn<(state: NavigationState, action: NavigationAction, context: GuardContext) => GuardResult>(() => ({type: 'ALLOW'})),
            };

            Guards.registerGuard(guard1);
            Guards.registerGuard(guard2);
            const result = Guards.evaluateGuards(mockState, mockAction, mockContext);

            expect(result.type).toBe('REDIRECT');
            expect(guard2.evaluate).not.toHaveBeenCalled();
        });

        it('should continue to next guard on ALLOW result', () => {
            const guard1: NavigationGuard = {
                name: 'Guard1',
                shouldApply: () => true,
                evaluate: () => ({type: 'ALLOW'}),
            };
            const guard2: NavigationGuard = {
                name: 'Guard2',
                shouldApply: () => true,
                evaluate: jest.fn<(state: NavigationState, action: NavigationAction, context: GuardContext) => GuardResult>(() => ({type: 'REDIRECT', route: '/test' as Route})),
            };

            Guards.registerGuard(guard1);
            Guards.registerGuard(guard2);
            const result = Guards.evaluateGuards(mockState, mockAction, mockContext);

            expect(result.type).toBe('REDIRECT');
            expect(guard2.evaluate).toHaveBeenCalled();
        });

        it('should respect guard evaluation order', () => {
            const evaluationOrder: string[] = [];

            const guard1: NavigationGuard = {
                name: 'Guard1',
                shouldApply: () => true,
                evaluate: () => {
                    evaluationOrder.push('Guard1');
                    return {type: 'ALLOW'};
                },
            };
            const guard2: NavigationGuard = {
                name: 'Guard2',
                shouldApply: () => true,
                evaluate: () => {
                    evaluationOrder.push('Guard2');
                    return {type: 'ALLOW'};
                },
            };
            const guard3: NavigationGuard = {
                name: 'Guard3',
                shouldApply: () => true,
                evaluate: () => {
                    evaluationOrder.push('Guard3');
                    return {type: 'ALLOW'};
                },
            };

            Guards.registerGuard(guard1);
            Guards.registerGuard(guard2);
            Guards.registerGuard(guard3);
            Guards.evaluateGuards(mockState, mockAction, mockContext);

            expect(evaluationOrder).toEqual(['Guard1', 'Guard2', 'Guard3']);
        });
    });

    describe('clearGuards', () => {
        it('should clear all registered guards', () => {
            const guard: NavigationGuard = {
                name: 'TestGuard',
                shouldApply: () => true,
                evaluate: () => ({type: 'ALLOW'}),
            };

            Guards.registerGuard(guard);
            expect(Guards.getRegisteredGuards()).toHaveLength(1);

            Guards.clearGuards();
            expect(Guards.getRegisteredGuards()).toHaveLength(0);
        });
    });

    describe('getRegisteredGuards', () => {
        it('should return empty array when no guards registered', () => {
            const guards = Guards.getRegisteredGuards();

            expect(guards).toEqual([]);
        });

        it('should return all registered guards', () => {
            const guard1: NavigationGuard = {
                name: 'Guard1',
                shouldApply: () => true,
                evaluate: () => ({type: 'ALLOW'}),
            };
            const guard2: NavigationGuard = {
                name: 'Guard2',
                shouldApply: () => true,
                evaluate: () => ({type: 'ALLOW'}),
            };

            Guards.registerGuard(guard1);
            Guards.registerGuard(guard2);
            const guards = Guards.getRegisteredGuards();

            expect(guards).toHaveLength(2);
            expect(guards).toContain(guard1);
            expect(guards).toContain(guard2);
        });
    });
});
