import {
    browserSupportsWebAuthn,
    startAuthentication,
    startRegistration,
} from '@simplewebauthn/browser';
import { useCallback, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';

type VerifyResponse = { redirect?: string };

type UsePasskeyVerifyOptions = {
    onSuccess?: (response: VerifyResponse) => void;
    routes?: {
        options: string;
        submit: string;
    };
};

type ProblemResponse = { title?: string };

/**
 * Compatibility for the copied `PasskeyVerify` component's login use only.
 * It deliberately maps the source component's default Laravel endpoints to
 * Rust's two explicit discoverable-passkey operations; it is not a generic
 * Laravel passkey client.
 */
export function usePasskeyVerify({ onSuccess, routes }: UsePasskeyVerifyOptions = {}) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isSupported = browserSupportsWebAuthn();

    const verify = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError(null);

        try {
            const csrfToken = await getCsrfToken();
            const isConfirmation = routes?.options === '/api/v1/account/passkeys/confirmation/options'
                && routes.submit === '/api/v1/account/passkeys/confirmation';
            if (routes && !isConfirmation) throw new Error('Passkey confirmation is not available on this route.');
            const options = isConfirmation
                ? await apiClient.POST('/account/passkeys/confirmation/options', { params: { header: { 'X-CSRF-Token': csrfToken } } })
                : await apiClient.POST('/session/passkey/options', { params: { header: { 'X-CSRF-Token': csrfToken } } });
            if (!options.response.ok || !options.data) {
                throw new Error(problemTitle(options.error, options.response.status));
            }

            const credential = await startAuthentication({
                optionsJSON: options.data.options as unknown as Parameters<typeof startAuthentication>[0]['optionsJSON'],
            });
            if (isConfirmation) {
                const completion = await apiClient.POST('/account/passkeys/confirmation', { body: credential as never, params: { header: { 'X-CSRF-Token': csrfToken } } });
                if (!completion.response.ok || completion.data?.confirmed !== true) throw new Error(problemTitle(completion.error, completion.response.status));
                onSuccess?.({ redirect: passwordConfirmationDestination() });
            } else {
                const completion = await apiClient.POST('/session/passkey', { body: credential as never, params: { header: { 'X-CSRF-Token': csrfToken } } });
                if (!completion.response.ok || completion.data?.authenticated !== true) throw new Error(problemTitle(completion.error, completion.response.status));
                onSuccess?.({ redirect: completion.data.redirect });
            }
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Passkey authentication could not be completed.');
        } finally {
            setIsLoading(false);
        }
    }, [onSuccess, routes]);

    return { verify, isLoading, error, isSupported };
}

type UsePasskeyRegisterOptions = {
    onSuccess?: () => void;
};

/**
 * Compatibility for the copied Security page's registration component only.
 * Its two Rust requests are fixed owner-scoped WebAuthn ceremony operations;
 * this does not expose Laravel's generic passkey client to other routes.
 */
export function usePasskeyRegister({ onSuccess }: UsePasskeyRegisterOptions = {}) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isSupported = browserSupportsWebAuthn();

    const register = useCallback(async (name: string): Promise<void> => {
        setIsLoading(true);
        setError(null);

        try {
            const csrfToken = await getCsrfToken();
            setCsrfMetaToken(csrfToken);
            const options = await apiClient.POST('/account/passkeys/options', {
                params: { header: { 'X-CSRF-Token': csrfToken } },
            });
            if (!options.response.ok || !options.data) {
                throw new Error(
                    options.response.status === 403
                        ? 'Password confirmation is required before registering a passkey.'
                        : problemTitle(options.error, options.response.status),
                );
            }
            const credential = await startRegistration({
                optionsJSON: options.data.options as unknown as Parameters<
                    typeof startRegistration
                >[0]['optionsJSON'],
            });
            const completed = await apiClient.POST('/account/passkeys', {
                body: { credential: credential as never, name },
                params: { header: { 'X-CSRF-Token': csrfToken } },
            });
            if (!completed.response.ok || !completed.data) {
                throw new Error(problemTitle(completed.error, completed.response.status));
            }
            onSuccess?.();
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'Passkey registration could not be completed.',
            );
        } finally {
            setIsLoading(false);
        }
    }, [onSuccess]);

    return { register, isLoading, error, isSupported };
}

function setCsrfMetaToken(token: string): void {
    let element = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    if (!element) {
        element = document.createElement('meta');
        element.name = 'csrf-token';
        document.head.appendChild(element);
    }
    element.content = token;
}

function passwordConfirmationDestination(): string {
    const returnTo = new URLSearchParams(window.location.search).get('return_to');

    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) return returnTo;

    return '/home';
}

function problemTitle(error: unknown, status: number): string {
    if (status === 503) {
        return 'Passkey authentication is currently unavailable.';
    }

    const title = typeof error === 'object' && error !== null
        ? (error as ProblemResponse).title
        : undefined;

    if (title) {
        return title;
    }

    return 'Passkey authentication was not accepted.';
}
