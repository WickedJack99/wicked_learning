import type { AnchorHTMLAttributes, PropsWithChildren } from 'react';

/**
 * This is deliberately not a general Inertia client. Future audited route
 * adapters may use these browser-only primitives, but Laravel requests,
 * sessions and form posts have no fallback implementation in the baseline.
 */
export function SourceHead({ title }: { title: string }) {
    document.title = title;

    return null;
}

export function SourceLink({
    children,
    ...props
}: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>) {
    return <a {...props}>{children}</a>;
}

export class SourceContractUnavailableError extends Error {
    public constructor(routeFamily: string) {
        super(`The ${routeFamily} source route has no audited Rust projection.`);
        this.name = 'SourceContractUnavailableError';
    }
}

export function unavailableSourceOperation(routeFamily: string): never {
    throw new SourceContractUnavailableError(routeFamily);
}
