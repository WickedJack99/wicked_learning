import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
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
            if (routes) {
                throw new Error('Passkey confirmation is not available on this route.');
            }

            const csrfToken = await getCsrfToken();
            const options = await apiClient.POST('/session/passkey/options', {
                params: { header: { 'X-CSRF-Token': csrfToken } },
            });
            if (!options.response.ok || !options.data) {
                throw new Error(problemTitle(options.error, options.response.status));
            }

            const credential = await startAuthentication({
                optionsJSON: options.data.options as unknown as Parameters<typeof startAuthentication>[0]['optionsJSON'],
            });
            const completion = await apiClient.POST('/session/passkey', {
                body: credential as never,
                params: { header: { 'X-CSRF-Token': csrfToken } },
            });
            if (!completion.response.ok || !completion.data?.authenticated) {
                throw new Error(problemTitle(completion.error, completion.response.status));
            }

            onSuccess?.({});
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Passkey authentication could not be completed.');
        } finally {
            setIsLoading(false);
        }
    }, [onSuccess, routes]);

    return { verify, isLoading, error, isSupported };
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
