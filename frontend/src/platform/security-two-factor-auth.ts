import QRCode from 'qrcode';
import { useCallback, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';

export const OTP_MAX_LENGTH = 6;

type PendingSetup = {
    manualSetupKey: string;
    provisioningUrl: string;
};

let pendingSetup: PendingSetup | null = null;

/** Keeps a one-time setup secret in memory only between the copied Form's
 * source action and the copied setup modal. */
export function rememberPendingTwoFactorSetup(setup: PendingSetup): void {
    pendingSetup = setup;
}

async function loadPendingSetup(): Promise<PendingSetup> {
    if (pendingSetup) {
        const setup = pendingSetup;
        pendingSetup = null;

        return setup;
    }

    const csrfToken = await getCsrfToken();
    const { data, response } = await apiClient.POST('/account/two-factor/setup', {
        params: { header: { 'X-CSRF-Token': csrfToken } },
    });

    if (!response.ok || !data) {
        throw new Error('Failed to fetch two-factor setup data.');
    }

    return {
        manualSetupKey: data.manual_setup_key,
        provisioningUrl: data.provisioning_url,
    };
}

export type UseTwoFactorAuthReturn = {
    qrCodeSvg: string | null;
    manualSetupKey: string | null;
    recoveryCodesList: string[];
    hasSetupData: boolean;
    errors: string[];
    clearErrors: () => void;
    clearSetupData: () => void;
    clearTwoFactorAuthData: () => void;
    fetchQrCode: () => Promise<void>;
    fetchSetupKey: () => Promise<void>;
    fetchSetupData: () => Promise<void>;
    fetchRecoveryCodes: () => Promise<void>;
};

/**
 * A route-local replacement for the copied hook's Laravel `useHttp` calls.
 * It covers only the source Security TOTP lifecycle and never stores a setup
 * secret outside this browser's live module state.
 */
export function useTwoFactorAuth(): UseTwoFactorAuthReturn {
    const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
    const [manualSetupKey, setManualSetupKey] = useState<string | null>(null);
    const [recoveryCodesList, setRecoveryCodesList] = useState<string[]>([]);
    const [errors, setErrors] = useState<string[]>([]);

    const clearErrors = useCallback(() => setErrors([]), []);
    const clearSetupData = useCallback(() => {
        setManualSetupKey(null);
        setQrCodeSvg(null);
        setErrors([]);
    }, []);
    const clearTwoFactorAuthData = useCallback(() => {
        setManualSetupKey(null);
        setQrCodeSvg(null);
        setRecoveryCodesList([]);
        setErrors([]);
    }, []);

    const fetchSetupData = useCallback(async () => {
        try {
            setErrors([]);
            const setup = await loadPendingSetup();
            const svg = await QRCode.toString(setup.provisioningUrl, {
                errorCorrectionLevel: 'M',
                type: 'svg',
            });
            setQrCodeSvg(svg);
            setManualSetupKey(setup.manualSetupKey);
        } catch {
            setQrCodeSvg(null);
            setManualSetupKey(null);
            setErrors(['Failed to fetch two-factor setup data.']);
        }
    }, []);

    const fetchQrCode = useCallback(async () => {
        await fetchSetupData();
    }, [fetchSetupData]);
    const fetchSetupKey = useCallback(async () => {
        await fetchSetupData();
    }, [fetchSetupData]);
    const fetchRecoveryCodes = useCallback(async () => {
        try {
            setErrors([]);
            const { data, response } = await apiClient.GET(
                '/account/two-factor/recovery-codes',
            );
            if (!response.ok || !data) {
                throw new Error('recovery codes unavailable');
            }
            setRecoveryCodesList(data.recovery_codes);
        } catch {
            setRecoveryCodesList([]);
            setErrors(['Failed to fetch recovery codes.']);
        }
    }, []);

    return {
        qrCodeSvg,
        manualSetupKey,
        recoveryCodesList,
        hasSetupData: qrCodeSvg !== null && manualSetupKey !== null,
        errors,
        clearErrors,
        clearSetupData,
        clearTwoFactorAuthData,
        fetchQrCode,
        fetchSetupKey,
        fetchSetupData,
        fetchRecoveryCodes,
    };
}
