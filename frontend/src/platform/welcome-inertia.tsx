import { useEffect, useState } from 'react';
import type { AnchorHTMLAttributes, FormEvent, PropsWithChildren, ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';

import { useSourcePageProjection } from './page-props';
import { unavailableSourceOperation } from './inertia-facade';
import { apiClient, getCsrfToken } from './api/client';
import { setTwoFactorLayoutProps } from './two-factor-layout';
import type { WelcomePageProps } from './welcome-projection';

type WelcomeLinkHref = string | { url: string };

export type InertiaLinkProps = Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'href'
> & {
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

export const router = {
    visit(url: string): void {
        window.location.assign(url);
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
    action: '/api/v1/session/login' | '/api/v1/registration' | '/api/v1/password/forgot' | '/api/v1/password/reset' | '/api/v1/session/two-factor';
    method: 'post';
    resetOnError?: boolean;
    resetOnSuccess?: string[] | boolean;
    children: (state: { errors: Record<string, string>; processing: boolean; clearErrors: () => void }) => ReactNode;
    className?: string;
    disableWhileProcessing?: boolean;
    transform?: (data: Record<string, string>) => Record<string, string>;
};

/**
 * The copied Login page is the only source form mounted by this adapter.
 * It obtains Rust's CSRF cookie/token and then submits the source fields to
 * the typed Rust session command in one click; it is not an Inertia form
 * emulator or a fallback/retry transport for other pages.
 */
export function Form({ action, children, className, resetOnSuccess, transform }: AuthFormProps) {
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});
        const form = event.currentTarget;
        const values = new FormData(form);

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
                    : action === '/api/v1/password/forgot' ? await apiClient.POST('/password/forgot', { body: { email: body.email }, params: { header: { 'X-CSRF-Token': csrfToken } } }) : action === '/api/v1/password/reset' ? await apiClient.POST('/password/reset', { body: transformed as never, params: { header: { 'X-CSRF-Token': csrfToken } } }) : await apiClient.POST('/session/two-factor', { body: transformed as never, params: { header: { 'X-CSRF-Token': csrfToken } } });

            const sessionStatus = data as { authenticated?: boolean; two_factor_required?: boolean } | undefined;
            const challengeRequired = action === '/api/v1/session/login'
                && response.ok
                && sessionStatus?.two_factor_required === true;
            const succeeded = action === '/api/v1/password/reset'
                ? response.ok
                : action === '/api/v1/password/forgot'
                    ? response.ok && Boolean(data)
                    : response.ok && Boolean(sessionStatus?.authenticated);
            if (challengeRequired) {
                window.location.assign('/two-factor-challenge');
                return;
            }
            if (!succeeded) {
                const errorField = action === '/api/v1/session/two-factor'
                    ? (values.get('recovery_code') ? 'recovery_code' : 'code')
                    : 'email';
                setErrors({
                    [errorField]: response.status === 503
                        ? action === '/api/v1/session/two-factor'
                            ? 'Two-factor authentication is currently unavailable.'
                            : 'Login is currently unavailable.'
                        : action === '/api/v1/session/two-factor'
                            ? 'The authentication code is invalid or expired.'
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
            } else {
                window.location.assign('/world');
            }
        } catch {
            setErrors({
                form: action === '/api/v1/session/two-factor'
                    ? 'Two-factor authentication is currently unavailable.'
                    : 'Login is currently unavailable.',
            });
        } finally {
            setProcessing(false);
        }
    };

    return <form className={className} onSubmit={submit}>{children({ errors, processing, clearErrors: () => setErrors({}) })}</form>;
}
