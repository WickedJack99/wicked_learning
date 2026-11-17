import { useEffect, useState } from 'react';
import type { AnchorHTMLAttributes, FormEvent, PropsWithChildren, ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';

import { useSourcePageProjection } from './page-props';
import { unavailableSourceOperation } from './inertia-facade';
import { apiClient, getCsrfToken } from './api/client';
import { setTwoFactorLayoutProps } from './two-factor-layout';
import { profileImageIdForSourceUrl } from './profile-media-upload';
import { rememberPendingTwoFactorSetup } from './security-two-factor-auth';
import type { WelcomePageProps } from './welcome-projection';

type WelcomeLinkHref = string | { url: string };

export type InertiaLinkProps = Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'href'
> & {
    as?: string;
    href: WelcomeLinkHref;
};

export function Head({ title }: { title: string }) {
    useEffect(() => {
        document.title = title;
    }, [title]);

    return null;
}

export function Link({
    children,
    href,
    as: _as,
    ...props
}: PropsWithChildren<InertiaLinkProps>) {
    const target = typeof href === 'string' ? href : href.url;

    return (
        <RouterLink {...props} to={target}>
            {children}
        </RouterLink>
    );
}

export function usePage<TProps extends object = WelcomePageProps>(): {
    component: string;
    props: TProps & WelcomePageProps;
} {
    const projection = useSourcePageProjection<TProps & WelcomePageProps>();

    if (!projection) {
        throw new Error('The Welcome source page was mounted without its audited Rust projection.');
    }

    return { component: projection.component, props: projection.props };
}

type RouterPatchOptions = {
    onFinish?: () => void;
    onStart?: () => void;
    preserveScroll?: boolean;
};

type RouterDeleteOptions = {
    onError?: () => void;
    preserveScroll?: boolean;
};

export const router = {
    visit(url: string): void {
        window.location.assign(url);
    },
    patch(
        url: string,
        data: unknown,
        options?: RouterPatchOptions,
    ): void {
        const payload = data as Record<string, unknown>;
        const locale = payload.locale;
        const isLanguage = url === '/settings/language' && typeof locale === 'string';
        const isSound = url === '/settings/sound-preferences'
            && typeof payload.muted === 'boolean'
            && typeof payload.effectsVolume === 'number'
            && typeof payload.ambienceVolume === 'number';
        const isFeedback = url === '/settings/feedback-prompt'
            && (payload.action === 'enable' || payload.action === 'decline');
        if (!isLanguage && !isSound && !isFeedback) {
            unavailableSourceOperation('Settings form submission');
        }

        void (async () => {
            options?.onStart?.();
            try {
                const csrfToken = await getCsrfToken();
                const { response } = isLanguage
                    ? await apiClient.PATCH('/learner/language-preference', {
                        body: { locale },
                        params: { header: { 'X-CSRF-Token': csrfToken } },
                    })
                    : isSound
                        ? await apiClient.PATCH('/learner/sound-preferences', {
                            body: {
                                ambience_volume: payload.ambienceVolume as number,
                                effects_volume: payload.effectsVolume as number,
                                muted: payload.muted as boolean,
                            },
                            params: { header: { 'X-CSRF-Token': csrfToken } },
                        })
                        : await apiClient.PATCH('/learner/feedback-prompt-preference', {
                            body: { action: payload.action as 'decline' | 'enable' },
                            params: { header: { 'X-CSRF-Token': csrfToken } },
                        });

                if (response.ok) {
                    // A source Inertia visit refreshes the source page props;
                    // this exact route may do the same after its typed write.
                    window.location.reload();
                }
            } finally {
                options?.onFinish?.();
            }
        })();
    },
    delete(url: string, options?: RouterDeleteOptions): void {
        const match = url.match(/^\/api\/v1\/account\/passkeys\/([0-9a-f-]{36})$/i);
        if (!match) {
            unavailableSourceOperation('Passkey deletion');
        }

        void (async () => {
            try {
                const csrfToken = await getCsrfToken();
                const { response } = await apiClient.DELETE(
                    '/account/passkeys/{passkey_id}',
                    {
                        params: {
                            header: { 'X-CSRF-Token': csrfToken },
                            path: { passkey_id: match[1] },
                        },
                    },
                );
                if (!response.ok) {
                    options?.onError?.();

                    return;
                }
                window.location.reload();
            } catch {
                options?.onError?.();
            }
        })();
    },
    reload(): void {
        window.location.reload();
    },
};

export function setLayoutProps(props: Record<string, unknown>): void {
    setTwoFactorLayoutProps({
        ...(typeof props.title === 'string' ? { title: props.title } : {}),
        ...(typeof props.description === 'string'
            ? { description: props.description }
            : {}),
    });
}

export function useHttp(): { submit: (_operation: unknown) => Promise<never> } {
    return {
        submit: async () => unavailableSourceOperation('two-factor enrollment'),
    };
}

type SourceFormData = Record<string, unknown>;

type SourceFormOptions = {
    onSuccess?: () => void;
    preserveScroll?: boolean;
};

/**
 * The public information source component creates its edit form before it
 * branches to its read-only variant. This deliberately provides only the
 * inert local form shape needed for that mount. Calling `patch` remains an
 * explicit unavailable operation: no Laravel form post or generic transport
 * is emulated by the standalone adapter.
 */
export function useForm<TData extends SourceFormData>(initialData: TData): {
    data: TData;
    errors: Partial<Record<keyof TData, string>>;
    patch: (url: string, options?: SourceFormOptions) => never;
    processing: boolean;
    setData: <Key extends keyof TData>(key: Key, value: TData[Key]) => void;
} {
    return {
        data: initialData,
        errors: {},
        patch: () => unavailableSourceOperation('platform information editing'),
        processing: false,
        setData: () => {},
    };
}

type AuthFormProps = {
    action: '/api/v1/session/login' | '/api/v1/registration' | '/api/v1/password/forgot' | '/api/v1/password/reset' | '/api/v1/session/two-factor' | '/api/v1/account/password/confirmation';
    method: 'post';
    resetOnError?: string[] | boolean;
    resetOnSuccess?: string[] | boolean;
    children: (state: { errors: Record<string, string>; processing: boolean; clearErrors: () => void; isDirty: boolean; resetAndClearErrors: () => void }) => ReactNode;
    className?: string;
    disableWhileProcessing?: boolean;
    id?: string;
    onError?: (errors: Record<string, string>) => void;
    onSuccess?: () => void;
    options?: SourceFormOptions;
    transform?: (data: Record<string, string>) => Record<string, string>;
};

type ProfileFormProps = {
    action: 'profile-update' | 'profile-delete';
    method: 'delete' | 'patch';
    children: AuthFormProps['children'];
    className?: string;
    id?: string;
    onError?: (errors: Record<string, string>) => void;
    onSuccess?: () => void;
    resetOnError?: string[] | boolean;
    options?: SourceFormOptions;
    resetOnSuccess?: string[] | boolean;
    transform?: never;
};

type SecurityFormAction =
    | 'security-password-update'
    | 'two-factor-confirm'
    | 'two-factor-disable'
    | 'two-factor-regenerate-codes'
    | 'two-factor-start-setup';

type SecurityFormProps = {
    action: SecurityFormAction;
    method: 'delete' | 'patch' | 'post';
    children: AuthFormProps['children'];
    className?: string;
    id?: string;
    onError?: (errors: Record<string, string>) => void;
    onSuccess?: () => void;
    options?: SourceFormOptions;
    resetOnError?: string[] | boolean;
    transform?: never;
    resetOnSuccess?: string[] | boolean;
};

/**
 * Each accepted action is an individually audited source form seam. The
 * adapter obtains Rust's CSRF cookie/token and calls only its matching typed
 * Rust command; it is not an Inertia form emulator or fallback transport.
 */
export function Form({ action, children, className, resetOnSuccess, transform, id, onError, onSuccess, resetOnError }: AuthFormProps | ProfileFormProps | SecurityFormProps) {
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});
        const form = event.currentTarget;
        const values = new FormData(form);

        if (action === 'profile-delete') {
            try {
                const csrfToken = await getCsrfToken();
                const { response } = await apiClient.DELETE('/account/profile', {
                    body: { password: String(values.get('password') ?? '') },
                    params: { header: { 'X-CSRF-Token': csrfToken } },
                });
                if (!response.ok) {
                    const nextErrors = {
                        password: response.status === 503
                            ? 'Account deletion is currently unavailable.'
                            : 'The password could not be confirmed.',
                    };
                    setErrors(nextErrors);
                    onError?.(nextErrors);
                    return;
                }
                window.location.assign('/');
            } catch {
                const nextErrors = { password: 'Account deletion is currently unavailable.' };
                setErrors(nextErrors);
                onError?.(nextErrors);
            } finally {
                setProcessing(false);
            }
            return;
        }

        if (isSecurityFormAction(action)) {
            try {
                const csrfToken = await getCsrfToken();
                const securityResult = await submitSecurityForm(
                    action,
                    values,
                    csrfToken,
                );
                if (!securityResult.ok) {
                    if (securityResult.passwordConfirmationRequired) {
                        window.location.assign(
                            '/user/confirm-password?return_to=/settings/security',
                        );
                        return;
                    }
                    const nextErrors = securityResult.errors;
                    setErrors(nextErrors);
                    onError?.(nextErrors);
                    resetFormFields(
                        form,
                        Array.isArray(resetOnError) ? resetOnError : [],
                    );
                    return;
                }
                onSuccess?.();
                if (
                    action === 'security-password-update' ||
                    action === 'two-factor-confirm' ||
                    action === 'two-factor-disable'
                ) {
                    window.location.reload();
                }
            } catch {
                const nextErrors = {
                    form: 'Security settings are currently unavailable.',
                };
                setErrors(nextErrors);
                onError?.(nextErrors);
            } finally {
                setProcessing(false);
            }
            return;
        }

        if (action === 'profile-update') {
            const profileImage = String(values.get('profile_image') ?? '');
            const profileImageId = profileImage ? profileImageIdForSourceUrl(profileImage) : null;
            if (profileImage && !profileImageId) {
                setErrors({ profile_image: 'The selected profile image is not available.' });
                setProcessing(false);
                return;
            }
            try {
                const csrfToken = await getCsrfToken();
                const { data, error, response } = await apiClient.PATCH('/account/profile', {
                    body: { email: String(values.get('email') ?? ''), name: String(values.get('name') ?? ''), profile_image_id: profileImageId, username: String(values.get('username') ?? '') || null },
                    params: { header: { 'X-CSRF-Token': csrfToken } },
                });
                if (!response.ok || !data) {
                    const problem = error as { errors?: Record<string, string> } | undefined;
                    setErrors(
                        response.status === 422 && problem?.errors
                            ? problem.errors
                            : { name: response.status === 503 ? 'Profile settings are currently unavailable.' : 'The profile could not be updated with these details.' },
                    );
                    return;
                }
                window.location.reload();
            } catch {
                setErrors({ name: 'Profile settings are currently unavailable.' });
            } finally {
                setProcessing(false);
            }
            return;
        }

        try {
            const csrfToken = await getCsrfToken();
            const raw = Object.fromEntries(values.entries()) as Record<string, string>;
            const transformed = transform ? transform(raw) : raw;
            const body = {
                email: String(transformed.email ?? ''), password: String(transformed.password ?? ''),
                ...(action === '/api/v1/session/login'
                    ? { remember: values.get('remember') === 'on' }
                    : {
                        appearance: String(values.get('appearance') ?? 'light'),
                        name: String(values.get('name') ?? ''),
                        password_confirmation: String(values.get('password_confirmation') ?? ''),
                        registration_token: String(values.get('registration_token') ?? ''),
                    }),
            };
            const { data, response } = action === '/api/v1/session/login'
                ? await apiClient.POST('/session/login', {
                body: {
                    email: body.email, password: body.password, remember: values.get('remember') === 'on',
                },
                params: { header: { 'X-CSRF-Token': csrfToken } },
                })
                : action === '/api/v1/registration'
                    ? await apiClient.POST('/registration', { body: body as never, params: { header: { 'X-CSRF-Token': csrfToken } } })
                    : action === '/api/v1/password/forgot' ? await apiClient.POST('/password/forgot', { body: { email: body.email }, params: { header: { 'X-CSRF-Token': csrfToken } } }) : action === '/api/v1/password/reset' ? await apiClient.POST('/password/reset', { body: transformed as never, params: { header: { 'X-CSRF-Token': csrfToken } } }) : action === '/api/v1/session/two-factor' ? await apiClient.POST('/session/two-factor', { body: transformed as never, params: { header: { 'X-CSRF-Token': csrfToken } } }) : await apiClient.POST('/account/password/confirmation', { body: { password: String(transformed.password ?? '') }, params: { header: { 'X-CSRF-Token': csrfToken } } });

            const sessionStatus = data as { authenticated?: boolean; two_factor_required?: boolean } | undefined;
            const passwordConfirmation = data as { confirmed?: boolean } | undefined;
            const challengeRequired = action === '/api/v1/session/login'
                && response.ok
                && sessionStatus?.two_factor_required === true;
            const succeeded = action === '/api/v1/password/reset'
                ? response.ok
                : action === '/api/v1/password/forgot'
                    ? response.ok && Boolean(data)
                    : action === '/api/v1/account/password/confirmation'
                        ? response.ok && passwordConfirmation?.confirmed === true
                    : response.ok && Boolean(sessionStatus?.authenticated);
            if (challengeRequired) {
                window.location.assign('/two-factor-challenge');
                return;
            }
            if (!succeeded) {
                const errorField = action === '/api/v1/session/two-factor'
                    ? (values.get('recovery_code') ? 'recovery_code' : 'code')
                    : action === '/api/v1/account/password/confirmation'
                        ? 'password'
                    : 'email';
                setErrors({
                    [errorField]: response.status === 503
                        ? action === '/api/v1/session/two-factor'
                            ? 'Two-factor authentication is currently unavailable.'
                            : action === '/api/v1/account/password/confirmation'
                                ? 'Password confirmation is currently unavailable.'
                            : 'Login is currently unavailable.'
                        : action === '/api/v1/session/two-factor'
                            ? 'The authentication code is invalid or expired.'
                            : action === '/api/v1/account/password/confirmation'
                                ? 'The password could not be confirmed.'
                            : 'The provided credentials are invalid.',
                });
                return;
            }

            const resetFields = resetOnSuccess === true
                ? Array.from(form.elements)
                    .filter((element): element is HTMLInputElement => element instanceof HTMLInputElement && Boolean(element.name))
                    .map((input) => input.name)
                : resetOnSuccess === false ? [] : resetOnSuccess ?? [];
            for (const field of resetFields) {
                const input = form.elements.namedItem(field);
                if (input instanceof HTMLInputElement) {
                    input.value = '';
                }
            }
            if (action === '/api/v1/password/forgot') {
                sessionStorage.setItem('wicked-password-reset-status', 'If that email address is registered, a password reset link has been sent.');
                window.location.reload();
            } else if (action === '/api/v1/account/password/confirmation') {
                window.location.assign(passwordConfirmationDestination());
            } else if (action === '/api/v1/password/reset') {
                sessionStorage.setItem('wicked-login-status', 'Your password has been reset.');
                window.location.assign('/login');
            } else if (action === '/api/v1/registration') {
                window.location.assign('/home');
            } else {
                window.location.assign('/world');
            }
        } catch {
            setErrors({
                form: action === '/api/v1/session/two-factor'
                    ? 'Two-factor authentication is currently unavailable.'
                    : action === '/api/v1/account/password/confirmation'
                        ? 'Password confirmation is currently unavailable.'
                    : 'Login is currently unavailable.',
            });
        } finally {
            setProcessing(false);
        }
    };

    return <form className={className} id={id} onChange={() => setIsDirty(true)} onSubmit={submit}>{children({ errors, processing, isDirty, clearErrors: () => setErrors({}), resetAndClearErrors: () => { formReset(document.getElementById(id ?? '') as HTMLFormElement | null); setErrors({}); } })}</form>;
}

function formReset(form: HTMLFormElement | null): void {
    form?.reset();
}

function isSecurityFormAction(action: string): action is SecurityFormAction {
    return [
        'security-password-update',
        'two-factor-confirm',
        'two-factor-disable',
        'two-factor-regenerate-codes',
        'two-factor-start-setup',
    ].includes(action);
}

type SecurityFormResult =
    | { ok: true }
    | { errors: Record<string, string>; ok: false; passwordConfirmationRequired?: boolean };

async function submitSecurityForm(
    action: SecurityFormAction,
    values: FormData,
    csrfToken: string,
): Promise<SecurityFormResult> {
    if (action === 'security-password-update') {
        const { error, response } = await apiClient.PATCH('/account/password', {
            body: {
                current_password: String(values.get('current_password') ?? ''),
                password: String(values.get('password') ?? ''),
                password_confirmation: String(
                    values.get('password_confirmation') ?? '',
                ),
            },
            params: { header: { 'X-CSRF-Token': csrfToken } },
        });
        if (response.ok) {
            return { ok: true };
        }
        const problem = error as { errors?: Record<string, string> } | undefined;
        return {
            errors:
                response.status === 422 && problem?.errors
                    ? problem.errors
                    : {
                          current_password:
                              response.status === 503
                                  ? 'Security settings are currently unavailable.'
                                  : 'The password could not be updated with these details.',
                      },
            ok: false,
        };
    }

    if (action === 'two-factor-start-setup') {
        const { data, response } = await apiClient.POST('/account/two-factor/setup', {
            params: { header: { 'X-CSRF-Token': csrfToken } },
        });
        if (response.ok && data) {
            rememberPendingTwoFactorSetup({
                manualSetupKey: data.manual_setup_key,
                provisioningUrl: data.provisioning_url,
            });
            return { ok: true };
        }
        return {
            errors: { form: 'Two-factor authentication is currently unavailable.' },
            ok: false,
            passwordConfirmationRequired: response.status === 403,
        };
    }

    if (action === 'two-factor-confirm') {
        const { response } = await apiClient.POST('/account/two-factor/confirm', {
            body: { code: String(values.get('code') ?? '') },
            params: { header: { 'X-CSRF-Token': csrfToken } },
        });
        return response.ok
            ? { ok: true }
            : {
                  errors: {
                      code:
                          response.status === 422
                              ? 'The authentication code is invalid or expired.'
                              : 'Two-factor authentication is currently unavailable.',
                  },
                  ok: false,
                  passwordConfirmationRequired: response.status === 403,
              };
    }

    if (action === 'two-factor-disable') {
        const { response } = await apiClient.DELETE('/account/two-factor', {
            params: { header: { 'X-CSRF-Token': csrfToken } },
        });
        return response.ok
            ? { ok: true }
            : {
                  errors: { form: 'Two-factor authentication is currently unavailable.' },
                  ok: false,
                  passwordConfirmationRequired: response.status === 403,
              };
    }

    const { response } = await apiClient.POST('/account/two-factor/recovery-codes', {
        params: { header: { 'X-CSRF-Token': csrfToken } },
    });
    return response.ok
        ? { ok: true }
        : {
              errors: { form: 'Recovery codes are currently unavailable.' },
              ok: false,
              passwordConfirmationRequired: response.status === 403,
          };
}

function resetFormFields(form: HTMLFormElement, fields: string[]): void {
    for (const field of fields) {
        const input = form.elements.namedItem(field);
        if (input instanceof HTMLInputElement) {
            input.value = '';
        }
    }
}

function passwordConfirmationDestination(): string {
    const returnTo = new URLSearchParams(window.location.search).get('return_to');

    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
        return returnTo;
    }

    return '/home';
}
