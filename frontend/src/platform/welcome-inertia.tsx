import { useEffect } from 'react';
import type { AnchorHTMLAttributes, PropsWithChildren } from 'react';
import { Link as RouterLink } from 'react-router';

import { useSourcePageProjection } from './page-props';
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
    props: TProps;
} {
    const projection = useSourcePageProjection<TProps>();

    if (!projection) {
        throw new Error('The Welcome source page was mounted without its audited Rust projection.');
    }

    return { props: projection.props };
}
