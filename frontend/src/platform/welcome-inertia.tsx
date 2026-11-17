import { useEffect } from 'react';
import type { AnchorHTMLAttributes, PropsWithChildren } from 'react';
import { Link as RouterLink } from 'react-router';

import { useSourcePageProjection } from './page-props';
import { unavailableSourceOperation } from './inertia-facade';
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
    props: TProps & WelcomePageProps;
} {
    const projection = useSourcePageProjection<TProps & WelcomePageProps>();

    if (!projection) {
        throw new Error('The Welcome source page was mounted without its audited Rust projection.');
    }

    return { props: projection.props };
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
