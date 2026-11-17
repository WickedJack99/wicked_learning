import type { components } from './api/schema';
import type { WelcomePageProps, WelcomeWireProjection } from './welcome-projection';
import { toWelcomePageProps } from './welcome-projection';

export type SourceLinksWireProjection = components['schemas']['PublicSourceLinks'];

/**
 * The copied source-code page keeps its source-link presentation data beneath
 * `publicPresentation`. Rust deliberately exposes it through its bounded
 * public source-links read, so this is the sole transport-name adaptation.
 */
export function toSourceCodePageProps(
    welcome: WelcomeWireProjection,
    sourceLinks: SourceLinksWireProjection,
): WelcomePageProps {
    const pageProps = toWelcomePageProps(welcome);

    return {
        ...pageProps,
        publicPresentation: {
            ...pageProps.publicPresentation,
            sourceLinks: {
                custom: sourceLinks.modified_sources,
                origin: sourceLinks.origin,
            },
        },
    };
}
