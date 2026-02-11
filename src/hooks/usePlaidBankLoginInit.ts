import {useEffect, useRef} from 'react';
import useNetwork from './useNetwork';

type UsePlaidBankLoginInitParams = {
    isAuthenticated: boolean;
    loginFn: () => void;
};

/**
 * Manages Plaid login lifecycle: calls loginFn on mount (unless already authenticated)
 * and re-calls loginFn on network reconnect.
 */
function usePlaidBankLoginInit({isAuthenticated, loginFn}: UsePlaidBankLoginInitParams): void {
    const hasInitRef = useRef(false);
    const loginFnRef = useRef(loginFn);
    const isAuthenticatedRef = useRef(isAuthenticated);
    useEffect(() => {
        loginFnRef.current = loginFn;
        isAuthenticatedRef.current = isAuthenticated;
    });

    useNetwork({
        onReconnect: () => {
            if (isAuthenticatedRef.current) {
                return;
            }
            loginFnRef.current();
        },
    });

    useEffect(() => {
        if (hasInitRef.current) {
            return;
        }
        hasInitRef.current = true;

        if (isAuthenticatedRef.current) {
            return;
        }
        loginFnRef.current();
    }, []);
}

export default usePlaidBankLoginInit;
