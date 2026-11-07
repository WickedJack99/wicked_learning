import { Eye, EyeOff, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { toDataURL } from 'qrcode';
import { useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';

type SetupData = {
    manualSetupKey: string;
    provisioningUrl: string;
};

/**
 * Adapted from `manage-two-factor.tsx`, `two-factor-setup-modal.tsx`, and
 * `two-factor-recovery-codes.tsx`. Inertia form transport is replaced only by
 * the typed Rust-owned identity contracts.
 */
export function OriginalTwoFactorManagement() {
    const navigate = useNavigate();
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
    const [codesAreVisible, setCodesAreVisible] = useState(false);
    const [setupData, setSetupData] = useState<SetupData | null>(null);
    const [showVerificationStep, setShowVerificationStep] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        let isCurrent = true;

        void apiClient
            .GET('/account/two-factor')
            .then(({ data, response }) => {
                if (!isCurrent) {
                    return;
                }
                if (response.ok && data) {
                    setEnabled(data.enabled);
                    return;
                }
                setError('Two-factor authentication is temporarily unavailable.');
            })
            .catch(() => {
                if (isCurrent) {
                    setError('Two-factor authentication is temporarily unavailable.');
                }
            });

        return () => {
            isCurrent = false;
        };
    }, []);

    useEffect(() => {
        let isCurrent = true;

        if (!setupData) {
            setQrCode(null);
            return () => {
                isCurrent = false;
            };
        }

        void toDataURL(setupData.provisioningUrl, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 256,
        })
            .then((nextQrCode) => {
                if (isCurrent) {
                    setQrCode(nextQrCode);
                }
            })
            .catch(() => {
                if (isCurrent) {
                    setError('The authentication setup code is unavailable.');
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [setupData]);

    function confirmationRequired(): void {
        navigate(
            '/confirm-password?next=%2Fsettings%3Fpanel%3Dpersonal%26personal%3Dsecurity',
            { replace: true },
        );
    }

    async function enable(): Promise<void> {
        setError(null);
        setProcessing(true);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST('/account/two-factor/setup', {
                params: { header: { 'X-CSRF-Token': token } },
            });
            if (response.status === 403) {
                confirmationRequired();
                return;
            }
            if (!response.ok || !data) {
                setError('Two-factor authentication is temporarily unavailable.');
                return;
            }
            setSetupData({
                manualSetupKey: data.manual_setup_key,
                provisioningUrl: data.provisioning_url,
            });
            setShowVerificationStep(false);
        } catch {
            setError('Two-factor authentication is temporarily unavailable.');
        } finally {
            setProcessing(false);
        }
    }

    async function confirmSetup(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (!setupData || verificationCode.length !== 6) {
            return;
        }
        setError(null);
        setProcessing(true);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST('/account/two-factor/confirm', {
                body: { code: verificationCode },
                params: { header: { 'X-CSRF-Token': token } },
            });
            if (response.status === 403) {
                confirmationRequired();
                return;
            }
            if (response.status === 422) {
                setError('The authentication code is not valid.');
                return;
            }
            if (!response.ok || !data) {
                setError('Two-factor authentication is temporarily unavailable.');
                return;
            }
            setRecoveryCodes(data.recovery_codes);
            setCodesAreVisible(true);
            closeSetup();
            setEnabled(true);
        } catch {
            setError('Two-factor authentication is temporarily unavailable.');
        } finally {
            setProcessing(false);
        }
    }

    async function loadRecoveryCodes(): Promise<void> {
        setError(null);
        setProcessing(true);
        try {
            const { data, response } = await apiClient.GET(
                '/account/two-factor/recovery-codes',
            );
            if (response.status === 403) {
                confirmationRequired();
                return;
            }
            if (!response.ok || !data) {
                setError('Recovery codes are temporarily unavailable.');
                return;
            }
            setRecoveryCodes(data.recovery_codes);
            setCodesAreVisible(true);
        } catch {
            setError('Recovery codes are temporarily unavailable.');
        } finally {
            setProcessing(false);
        }
    }

    async function toggleCodesVisibility(): Promise<void> {
        if (!codesAreVisible && recoveryCodes.length === 0) {
            await loadRecoveryCodes();
            return;
        }
        setCodesAreVisible((current) => !current);
    }

    async function regenerateRecoveryCodes(): Promise<void> {
        setError(null);
        setProcessing(true);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/account/two-factor/recovery-codes',
                { params: { header: { 'X-CSRF-Token': token } } },
            );
            if (response.status === 403) {
                confirmationRequired();
                return;
            }
            if (!response.ok || !data) {
                setError('Recovery codes are temporarily unavailable.');
                return;
            }
            setRecoveryCodes(data.recovery_codes);
            setCodesAreVisible(true);
        } catch {
            setError('Recovery codes are temporarily unavailable.');
        } finally {
            setProcessing(false);
        }
    }

    async function disable(): Promise<void> {
        setError(null);
        setProcessing(true);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.DELETE('/account/two-factor', {
                params: { header: { 'X-CSRF-Token': token } },
            });
            if (response.status === 403) {
                confirmationRequired();
                return;
            }
            if (!response.ok || !data) {
                setError('Two-factor authentication is temporarily unavailable.');
                return;
            }
            setEnabled(false);
            setRecoveryCodes([]);
            setCodesAreVisible(false);
        } catch {
            setError('Two-factor authentication is temporarily unavailable.');
        } finally {
            setProcessing(false);
        }
    }

    function closeSetup(): void {
        setSetupData(null);
        setShowVerificationStep(false);
        setVerificationCode('');
    }

    if (enabled === null && !error) {
        return null;
    }

    return (
        <section className="border-t border-[var(--settings-border-color)] pt-5">
            <div className="min-w-0 space-y-6">
                <header>
                    <h2 className="text-xl font-semibold">Two-factor authentication</h2>
                    <p className="mt-2 text-sm text-[var(--settings-muted-text)]">
                        Manage your two-factor authentication settings
                    </p>
                </header>
                {enabled === true ? (
                    <div className="flex min-w-0 flex-col items-start justify-start space-y-4">
                        <p className="text-sm text-[var(--settings-muted-text)]">
                            You will be prompted for a secure, random pin during login,
                            which you can retrieve from the TOTP-supported application
                            on your phone.
                        </p>
                        <button
                            className="inline-flex items-center rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            disabled={processing}
                            onClick={() => void disable()}
                            type="button"
                        >
                            Disable 2FA
                        </button>
                        <section className="w-full max-w-full min-w-0 rounded-lg border border-[var(--settings-border-color)] p-5">
                            <header>
                                <h3 className="flex min-w-0 gap-3 text-base font-semibold">
                                    <LockKeyhole aria-hidden="true" className="size-4" />
                                    2FA recovery codes
                                </h3>
                                <p className="mt-2 text-sm text-[var(--settings-muted-text)]">
                                    Recovery codes let you regain access if you lose your 2FA
                                    device. Store them in a secure password manager.
                                </p>
                            </header>
                            <div className="mt-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <button
                                    aria-controls="recovery-codes-section"
                                    aria-expanded={codesAreVisible}
                                    className="inline-flex w-fit items-center gap-2 rounded-md bg-[var(--settings-accent)] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                                    disabled={processing}
                                    onClick={() => void toggleCodesVisibility()}
                                    type="button"
                                >
                                    {codesAreVisible ? (
                                        <EyeOff aria-hidden="true" className="size-4" />
                                    ) : (
                                        <Eye aria-hidden="true" className="size-4" />
                                    )}
                                    {codesAreVisible ? 'Hide' : 'View'} recovery codes
                                </button>
                                {codesAreVisible ? (
                                    <button
                                        aria-describedby="regenerate-warning"
                                        className="inline-flex w-fit items-center gap-2 rounded-md border border-[var(--settings-border-color)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                                        disabled={processing}
                                        onClick={() => void regenerateRecoveryCodes()}
                                        type="button"
                                    >
                                        <RefreshCw aria-hidden="true" className="size-4" />
                                        Regenerate codes
                                    </button>
                                ) : null}
                            </div>
                            {codesAreVisible ? (
                                <div className="mt-3 min-w-0 space-y-3" id="recovery-codes-section">
                                    <div
                                        aria-label="Recovery codes"
                                        className="grid min-w-0 gap-1 overflow-hidden rounded-md border border-[var(--settings-border-color)] p-4 font-mono text-sm"
                                        role="list"
                                    >
                                        {recoveryCodes.map((code) => (
                                            <div className="break-all select-text" key={code} role="listitem">
                                                {code}
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-[var(--settings-muted-text)]" id="regenerate-warning">
                                        Each recovery code can be used once to access your
                                        account and will be removed after use. If you need more,
                                        click <strong>Regenerate codes</strong> above.
                                    </p>
                                </div>
                            ) : null}
                        </section>
                    </div>
                ) : enabled === false ? (
                    <div className="flex min-w-0 flex-col items-start justify-start space-y-4">
                        <p className="text-sm text-[var(--settings-muted-text)]">
                            When you enable two-factor authentication, you will be prompted
                            for a secure pin during login. This pin can be retrieved from a
                            TOTP-supported application on your phone.
                        </p>
                        <button
                            className="inline-flex items-center gap-2 rounded-md bg-[var(--settings-accent)] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                            disabled={processing}
                            onClick={() => void enable()}
                            type="button"
                        >
                            <ShieldCheck aria-hidden="true" className="size-4" />
                            Enable 2FA
                        </button>
                    </div>
                ) : null}
                {error ? <p className="text-sm text-red-500" role="alert">{error}</p> : null}
            </div>
            {setupData ? (
                <div
                    aria-modal="true"
                    className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
                    role="dialog"
                >
                    <section className="w-full max-w-md rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-6 shadow-xl">
                        {showVerificationStep ? (
                            <form onSubmit={(event) => void confirmSetup(event)}>
                                <h2 className="text-center text-lg font-semibold">
                                    Verify authentication code
                                </h2>
                                <p className="mt-2 text-center text-sm text-[var(--settings-muted-text)]">
                                    Enter the 6-digit code from your authenticator app
                                </p>
                                <label className="mt-5 grid gap-2" htmlFor="two-factor-code">
                                    <span className="sr-only">Authentication code</span>
                                    <input
                                        aria-label="Authentication code"
                                        autoComplete="one-time-code"
                                        autoFocus
                                        className="h-10 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] px-3 text-center font-mono text-lg tracking-[0.35em]"
                                        id="two-factor-code"
                                        inputMode="numeric"
                                        maxLength={6}
                                        onChange={(event) =>
                                            setVerificationCode(
                                                event.currentTarget.value
                                                    .replace(/\D/g, '')
                                                    .slice(0, 6),
                                            )
                                        }
                                        required
                                        value={verificationCode}
                                    />
                                </label>
                                <div className="mt-5 flex gap-3">
                                    <button
                                        className="flex-1 rounded-md border border-[var(--settings-border-color)] px-4 py-2 text-sm font-semibold"
                                        disabled={processing}
                                        onClick={() => setShowVerificationStep(false)}
                                        type="button"
                                    >
                                        Back
                                    </button>
                                    <button
                                        className="flex-1 rounded-md bg-[var(--settings-accent)] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                                        disabled={processing || verificationCode.length !== 6}
                                        type="submit"
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <>
                                <h2 className="text-center text-lg font-semibold">
                                    Enable two-factor authentication
                                </h2>
                                <p className="mt-2 text-center text-sm text-[var(--settings-muted-text)]">
                                    To finish enabling two-factor authentication, scan the QR
                                    code or enter the setup key in your authenticator app
                                </p>
                                <div className="mx-auto mt-5 flex aspect-square w-64 items-center justify-center rounded-lg border border-[var(--settings-border-color)] bg-white p-5">
                                    {qrCode ? (
                                        <img alt="Authenticator setup QR code" src={qrCode} />
                                    ) : (
                                        <span className="text-sm text-slate-700">Loading…</span>
                                    )}
                                </div>
                                <button
                                    className="mt-5 w-full rounded-md bg-[var(--settings-accent)] px-4 py-2 text-sm font-semibold text-slate-950"
                                    onClick={() => setShowVerificationStep(true)}
                                    type="button"
                                >
                                    Continue
                                </button>
                                <p className="my-4 text-center text-sm text-[var(--settings-muted-text)]">
                                    or, enter the code manually
                                </p>
                                <input
                                    aria-label="Manual setup key"
                                    className="h-10 w-full rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] px-3 font-mono text-sm"
                                    readOnly
                                    value={setupData.manualSetupKey}
                                />
                            </>
                        )}
                        <button
                            className="mt-4 w-full text-sm text-[var(--settings-muted-text)] underline"
                            disabled={processing}
                            onClick={closeSetup}
                            type="button"
                        >
                            Cancel
                        </button>
                    </section>
                </div>
            ) : null}
        </section>
    );
}
