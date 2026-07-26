import { usePasskeyRegister } from '@laravel/passkeys/react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { store as confirmPassword } from '@/routes/password/confirm';

type Props = {
    onSuccess: () => void;
};

export default function PasskeyRegistration({ onSuccess }: Props) {
    const [name, setName] = useState(() => {
        const ua = navigator.userAgent;

        const browser = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera'].find(
            (browser) => new RegExp(browser).test(ua),
        );

        const os = ['iPhone', 'iPad', 'Android', 'Mac', 'Windows'].find((os) =>
            new RegExp(os).test(ua),
        );

        return [browser, os].filter(Boolean).join(' on ') || '';
    });

    const [showForm, setShowForm] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [isConfirmingPassword, setIsConfirmingPassword] = useState(false);
    const { register, isLoading, error, isSupported } = usePasskeyRegister({
        onSuccess: () => {
            setName('');
            setPassword('');
            setPasswordError(null);
            setShowForm(false);
            onSuccess();
        },
    });
    const requiresPasswordConfirmation = isPasswordConfirmationError(error);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            return;
        }

        if (requiresPasswordConfirmation) {
            if (!password) {
                setPasswordError('Please enter your password.');

                return;
            }

            setIsConfirmingPassword(true);
            const confirmed = await confirmCurrentPassword(password)
                .catch(() => ({
                    message:
                        'The password confirmation could not be completed.',
                    ok: false,
                }))
                .finally(() => setIsConfirmingPassword(false));

            if (!confirmed.ok) {
                setPasswordError(
                    confirmed.message ??
                        'The password confirmation could not be completed.',
                );

                return;
            }

            setPassword('');
            setPasswordError(null);
        }

        await register(name);
    };

    const handleCancel = () => {
        setShowForm(false);
        setName('');
        setPassword('');
        setPasswordError(null);
    };

    if (!isSupported) {
        return (
            <div className="text-sm text-muted-foreground">
                Passkeys are not supported in this browser.
            </div>
        );
    }

    if (!showForm) {
        return (
            <Button variant="outline" onClick={() => setShowForm(true)}>
                Add passkey
            </Button>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-lg border border-border bg-muted/50 p-4"
        >
            <div className="grid gap-2">
                <Label htmlFor="passkey-name">Passkey name</Label>
                <Input
                    id="passkey-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., MacBook Pro, iPhone"
                    className="mt-1 block w-full border-foreground/20"
                    autoFocus
                />
                <p className="text-xs text-muted-foreground">
                    A name helps you identify this passkey later.
                </p>
            </div>

            {requiresPasswordConfirmation ? (
                <div className="grid gap-2">
                    <Label htmlFor="passkey-password">
                        Confirm your password
                    </Label>
                    <PasswordInput
                        autoComplete="current-password"
                        id="passkey-password"
                        onChange={(event) => {
                            setPassword(event.currentTarget.value);
                            setPasswordError(null);
                        }}
                        placeholder="Password"
                        value={password}
                    />
                    <p className="text-xs text-muted-foreground">
                        This confirms it is really you before adding a new
                        sign-in method.
                    </p>
                    <InputError message={passwordError ?? undefined} />
                </div>
            ) : null}

            {error && !requiresPasswordConfirmation ? (
                <InputError message={formatRegistrationError(error)} />
            ) : null}

            <div className="flex gap-2">
                <Button
                    type="submit"
                    disabled={
                        isLoading ||
                        isConfirmingPassword ||
                        !name.trim() ||
                        (requiresPasswordConfirmation && !password)
                    }
                >
                    {isLoading || isConfirmingPassword
                        ? 'Registering...'
                        : 'Register passkey'}
                </Button>
                <Button type="button" variant="ghost" onClick={handleCancel}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}

function isPasswordConfirmationError(error: string | null): boolean {
    return error?.toLowerCase().includes('password confirmation') ?? false;
}

function formatRegistrationError(error: string): string {
    const normalizedError = error.toLowerCase();

    if (
        normalizedError.includes('status 500') ||
        normalizedError.includes('invalid origin')
    ) {
        return 'Passkey registration failed because this browser origin is not allowed by the server. Please check APP_URL or PASSKEYS_ALLOWED_ORIGINS.';
    }

    return error;
}

async function confirmCurrentPassword(
    password: string,
): Promise<{ message?: string; ok: boolean }> {
    const csrfToken = document
        .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
        ?.getAttribute('content');

    const response = await fetch(confirmPassword.url(), {
        body: JSON.stringify({ password }),
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
        },
        method: 'POST',
    });

    if (response.ok) {
        return { ok: true };
    }

    if (response.status === 422) {
        const payload = (await response.json().catch(() => null)) as {
            errors?: { password?: string[] };
            message?: string;
        } | null;

        return {
            message:
                payload?.errors?.password?.[0] ??
                payload?.message ??
                'The provided password was incorrect.',
            ok: false,
        };
    }

    return {
        message: 'The password confirmation could not be completed.',
        ok: false,
    };
}
