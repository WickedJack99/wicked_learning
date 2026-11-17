import { useEffect, useState } from 'react';
import type { AnchorHTMLAttributes, FormEvent, PropsWithChildren, ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';

import { useSourcePageProjection } from './page-props';
import { unavailableSourceOperation } from './inertia-facade';
import { apiClient, getCsrfToken } from './api/client';
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
    action: '/api/v1/session/login' | '/api/v1/registration';
    method: 'post';
    resetOnSuccess?: string[];
    children: (state: { errors: Record<string, string>; processing: boolean }) => ReactNode;
    className?: string;
    disableWhileProcessing?: boolean;
};

/**
 * The copied Login page is the only source form mounted by this adapter.
 * It obtains Rust's CSRF cookie/token and then submits the source fields to
 * the typed Rust session command in one click; it is not an Inertia form
 * emulator or a fallback/retry transport for other pages.
 */
export function Form({ action, children, className, resetOnSuccess }: AuthFormProps) {
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setProcessing(true);
        setErrors({});
        const values = new FormData(event.currentTarget);

        try {
            const csrfToken = await getCsrfToken();
            const body = {
                email: String(values.get('email') ?? ''),
                password: String(values.get('password') ?? ''),
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
                : await apiClient.POST('/registration', { body: body as never, params: { header: { 'X-CSRF-Token': csrfToken } } });

            if (!response.ok || !data?.authenticated) {
                setErrors({
                    email: response.status === 503
                        ? 'Login is currently unavailable.'
                        : 'The provided credentials are invalid.',
                });
                return;
            }

            for (const field of resetOnSuccess ?? []) {
                const input = event.currentTarget.elements.namedItem(field);
                if (input instanceof HTMLInputElement) {
                    input.value = '';
                }
            }
            window.location.assign('/world');
        } catch {
            setErrors({ form: 'Login is currently unavailable.' });
        } finally {
            setProcessing(false);
        }
    };

    return <form className={className} onSubmit={submit}>{children({ errors, processing })}</form>;
}
