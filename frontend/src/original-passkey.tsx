import {
    browserSupportsWebAuthn,
    startAuthentication,
    startRegistration,
    type PublicKeyCredentialCreationOptionsJSON,
    type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { KeyRound, Trash2, X } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';

type Passkey = components['schemas']['PasskeySummary'];

/**
 * Transport adapter for the original `passkey-verify.tsx`. WebAuthn's binary
 * conversion and browser invocation remain in SimpleWebAuthn; this component
 * only replaces Laravel's route/form glue with the typed Rust contract.
 */
export function OriginalPasskeyVerify({
    label = 'Sign in with a passkey',
    loadingLabel = 'Authenticating...',
    onSuccess,
    optionsPath = '/session/passkey/options',
    separator = 'Or continue with email',
    submitPath = '/session/passkey',
}: {
    label?: string;
    loadingLabel?: string;
    onSuccess: () => void;
    optionsPath?: '/session/passkey/options' | '/account/passkeys/confirmation/options';
    separator?: string;
    submitPath?: '/session/passkey' | '/account/passkeys/confirmation';
}) {
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    if (!browserSupportsWebAuthn()) {
        return null;
    }

    async function verify(): Promise<void> {
        setError(null);
        setIsLoading(true);
        try {
            const token = await getCsrfToken();
            const { data: options, response: optionsResponse } = await apiClient.POST(
                optionsPath,
                { params: { header: { 'X-CSRF-Token': token } } },
            );
            if (!optionsResponse.ok || !options) {
                setError('Passkey verification could not be started.');
                return;
            }
            const credential = await startAuthentication({
                optionsJSON: options.options as unknown as PublicKeyCredentialRequestOptionsJSON,
            });
            const { response } = await apiClient.POST(submitPath, {
                body: credential as unknown as components['schemas']['WebAuthnCredential'],
                params: { header: { 'X-CSRF-Token': token } },
            });
            if (!response.ok) {
                setError('Passkey verification could not be completed.');
                return;
            }
            onSuccess();
        } catch (reason) {
            setError(passkeyErrorMessage(reason));
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <>
            <div className="grid gap-2">
                <button
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[var(--auth-input-border-color)] bg-[var(--auth-input-background)] px-4 py-2 text-sm font-medium text-[var(--auth-label-text-color)] transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                    disabled={isLoading}
                    onClick={() => void verify()}
                    type="button"
                >
                    <KeyRound className="h-4 w-4" />
                    {isLoading ? loadingLabel : label}
                </button>
                {error ? <p className="text-center text-sm text-red-300" role="alert">{error}</p> : null}
            </div>
            <p className="my-6 text-center text-xs text-[var(--auth-description-text-color)] uppercase">
                {separator}
            </p>
        </>
    );
}

/** Adapted from the source `manage-passkeys.tsx`, registration and item views. */
export function OriginalPasskeyManagement() {
    const navigate = useNavigate();
    const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [registrationVisible, setRegistrationVisible] = useState(false);
    const [name, setName] = useState(defaultPasskeyName);
    const [processing, setProcessing] = useState(false);
    const [removing, setRemoving] = useState<Passkey | null>(null);

    const confirmationPath = '/confirm-password?next=%2Fsettings%3Fpanel%3Dpersonal%26personal%3Dsecurity';

    async function load(): Promise<void> {
        const { data, response } = await apiClient.GET('/account/passkeys');
        if (response.status === 401) {
            navigate('/login', { replace: true });
            return;
        }
        if (response.status === 403) {
            navigate(confirmationPath, { replace: true });
            return;
        }
        if (!response.ok || !data) {
            setError('Passkeys are temporarily unavailable.');
            return;
        }
        setPasskeys(data);
    }

    useEffect(() => {
        void load().catch(() => setError('Passkeys are temporarily unavailable.'));
    // The initial protected load is deliberately once; successful mutations refresh it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function register(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName || processing) return;
        setError(null);
        setProcessing(true);
        try {
            const token = await getCsrfToken();
            const { data: options, response: optionsResponse } = await apiClient.POST(
                '/account/passkeys/options',
                { params: { header: { 'X-CSRF-Token': token } } },
            );
            if (optionsResponse.status === 403) {
                navigate(confirmationPath, { replace: true });
                return;
            }
            if (!optionsResponse.ok || !options) {
                setError('Passkey registration could not be started.');
                return;
            }
            const credential = await startRegistration({
                optionsJSON: options.options as unknown as PublicKeyCredentialCreationOptionsJSON,
            });
            const { response } = await apiClient.POST('/account/passkeys', {
                body: {
                    credential: credential as unknown as components['schemas']['WebAuthnCredential'],
                    name: trimmedName,
                },
                params: { header: { 'X-CSRF-Token': token } },
            });
            if (!response.ok) {
                setError('Passkey registration could not be completed.');
                return;
            }
            setName(defaultPasskeyName());
            setRegistrationVisible(false);
            await load();
        } catch (reason) {
            setError(passkeyErrorMessage(reason));
        } finally {
            setProcessing(false);
        }
    }

    async function remove(): Promise<void> {
        if (!removing || processing) return;
        setError(null);
        setProcessing(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE('/account/passkeys/{passkey_id}', {
                params: {
                    header: { 'X-CSRF-Token': token },
                    path: { passkey_id: removing.id },
                },
            });
            if (response.status === 403) {
                navigate(confirmationPath, { replace: true });
                return;
            }
            if (!response.ok) {
                setError('The passkey could not be removed.');
                return;
            }
            setRemoving(null);
            await load();
        } catch {
            setError('The passkey could not be removed.');
        } finally {
            setProcessing(false);
        }
    }

    if (!browserSupportsWebAuthn()) {
        return <div className="text-sm text-muted-foreground">Passkeys are not supported in this browser.</div>;
    }

    return (
        <section className="space-y-6">
            <header>
                <h3 className="text-lg font-semibold">Passkeys</h3>
                <p className="mt-1 text-sm text-[var(--settings-muted-text)]">Manage your passkeys for passwordless sign-in</p>
            </header>
            <div className="settings-rounded-control overflow-hidden rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)]">
                {passkeys === null ? <p className="p-4 text-sm text-[var(--settings-muted-text)]">Loading passkeys…</p> : passkeys.length > 0 ? passkeys.map((passkey) => <PasskeyItem key={passkey.id} onDelete={() => setRemoving(passkey)} passkey={passkey} />) : <PasskeyEmptyState />}
            </div>
            {registrationVisible ? (
                <form className="settings-rounded-control space-y-4 rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] p-4" onSubmit={(event) => void register(event)}>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="passkey-name">Passkey name</label>
                        <input autoFocus className="mt-1 block w-full rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] px-3 py-2 text-sm" id="passkey-name" maxLength={255} onChange={(event) => setName(event.currentTarget.value)} placeholder="e.g., MacBook Pro, iPhone" required value={name} />
                        <p className="text-xs text-[var(--settings-muted-text)]">A name helps you identify this passkey later.</p>
                    </div>
                    <div className="flex gap-2">
                        <button className="rounded-md bg-[var(--settings-accent)] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50" disabled={processing || !name.trim()} type="submit">{processing ? 'Registering...' : 'Register passkey'}</button>
                        <button className="rounded-md px-4 py-2 text-sm font-medium hover:bg-[var(--settings-active-background)]" onClick={() => setRegistrationVisible(false)} type="button">Cancel</button>
                    </div>
                </form>
            ) : <button className="rounded-md border border-[var(--settings-border-color)] px-4 py-2 text-sm font-medium hover:bg-[var(--settings-active-background)]" onClick={() => setRegistrationVisible(true)} type="button">Add passkey</button>}
            {error ? <p className="text-sm text-red-500" role="alert">{error}</p> : null}
            {removing ? <RemovePasskeyDialog onCancel={() => setRemoving(null)} onConfirm={() => void remove()} passkey={removing} processing={processing} /> : null}
        </section>
    );
}

function PasskeyEmptyState() {
    return <div className="p-8 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--settings-content-background)]"><KeyRound className="h-7 w-7 text-[var(--settings-muted-text)]" /></div><p className="font-medium">No passkeys yet</p><p className="mt-1 text-sm text-[var(--settings-muted-text)]">Add a passkey to sign in without a password</p></div>;
}

function PasskeyItem({ onDelete, passkey }: { onDelete: () => void; passkey: Passkey }) {
    return <div className="flex items-center justify-between border-b border-[var(--settings-border-color)] p-4 last:border-b-0"><div className="flex items-center gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--settings-content-background)]"><KeyRound className="h-5 w-5 text-[var(--settings-muted-text)]" /></div><div className="space-y-1"><div className="flex items-center gap-2.5"><p className="font-medium tracking-tight">{passkey.name}</p>{passkey.authenticator ? <span className="inline-flex items-center gap-1 rounded-md bg-[var(--settings-content-background)] px-2 py-0.5 text-xs font-medium tracking-wide text-[var(--settings-muted-text)] uppercase ring-1 ring-[var(--settings-border-color)] ring-inset">{passkey.authenticator}</span> : null}</div><p className="text-sm text-[var(--settings-muted-text)]">Added {relativeDate(passkey.created_at)}{passkey.last_used_at ? <><span className="mx-1 opacity-50">/</span>Last used {relativeDate(passkey.last_used_at)}</> : null}</p></div></div><button aria-label="Remove passkey" className="rounded-md p-2 text-red-600 hover:bg-red-500/10" onClick={onDelete} type="button"><Trash2 className="h-4 w-4" /><span className="sr-only">Remove</span></button></div>;
}

function RemovePasskeyDialog({ onCancel, onConfirm, passkey, processing }: { onCancel: () => void; onConfirm: () => void; passkey: Passkey; processing: boolean }) {
    return <div aria-labelledby="remove-passkey-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog"><section className="w-full max-w-md rounded-lg bg-[var(--settings-panel-background)] p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-semibold" id="remove-passkey-title">Remove passkey</h3><p className="mt-2 text-sm leading-6 text-[var(--settings-muted-text)]">Are you sure you want to remove the &quot;{passkey.name}&quot; passkey? You will no longer be able to use it to sign in.</p></div><button aria-label="Close" className="rounded-md p-1" onClick={onCancel} type="button"><X className="h-4 w-4" /></button></div><div className="mt-6 flex justify-end gap-2"><button className="rounded-md px-4 py-2 text-sm font-medium hover:bg-[var(--settings-active-background)]" onClick={onCancel} type="button">Cancel</button><button className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={processing} onClick={onConfirm} type="button">{processing ? 'Removing...' : 'Remove passkey'}</button></div></section></div>;
}

function defaultPasskeyName(): string {
    const userAgent = navigator.userAgent;
    const browser = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera'].find((value) => new RegExp(value).test(userAgent));
    const operatingSystem = ['iPhone', 'iPad', 'Android', 'Mac', 'Windows'].find((value) => new RegExp(value).test(userAgent));
    return [browser, operatingSystem].filter(Boolean).join(' on ');
}

function passkeyErrorMessage(reason: unknown): string {
    if (reason instanceof Error && reason.name === 'NotAllowedError') return 'The passkey request was cancelled or not accepted.';
    return 'Passkey verification could not be completed.';
}

function relativeDate(value: string): string {
    const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1_000);
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [['year', 31_536_000], ['month', 2_592_000], ['day', 86_400], ['hour', 3_600], ['minute', 60], ['second', 1]];
    const [unit, divisor] = units.find(([, amount]) => Math.abs(seconds) >= amount) ?? ['second', 1];
    return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(seconds / divisor), unit);
}
