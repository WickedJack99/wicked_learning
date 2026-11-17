import type { components } from './api/schema';
import type { WelcomePageProps, WelcomeWireProjection } from './welcome-projection';
import { toWelcomePageProps } from './welcome-projection';

export type PublicInformationWirePage = components['schemas']['PublicPage'];

export type PublicInformationPageProps = WelcomePageProps & {
    canEditPlatformInfo: false;
    platformInfoContent: {
        key: string;
        markdown: string;
        updated_at: null;
        updated_by: null;
    };
};

/**
 * Adds the one published information document to the bounded source-shaped
 * Welcome shell. The source page owns its title/theme/content precedence;
 * this adapter merely maps Rust wire names to its expected props.
 */
export function toPublicInformationPageProps(
    welcome: WelcomeWireProjection,
    page: PublicInformationWirePage,
): PublicInformationPageProps {
    return {
        ...toWelcomePageProps(welcome),
        canEditPlatformInfo: false,
        platformInfoContent: {
            key: page.slug,
            markdown: page.body,
            updated_at: null,
            updated_by: null,
        },
    };
}
