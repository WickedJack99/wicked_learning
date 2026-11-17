import type { components } from './api/schema';
import type { PublicPresentationSettings } from '@/theme/presentation';

export type WelcomeWireProjection = components['schemas']['WelcomePageProjection'];

export type WelcomePageProps = {
    auth: WelcomeWireProjection['auth'];
    appearance: WelcomeWireProjection['appearance'];
    localization: {
        locale: 'en';
        translations: Record<string, string>;
    };
    publicPresentation: PublicPresentationSettings;
};

/**
 * Maps the bounded Rust welcome document to the field names consumed by the
 * copied source component. Every value here comes from the read projection;
 * source fallbacks own omitted optional presentation fields.
 */
export function toWelcomePageProps(
    projection: WelcomeWireProjection,
): WelcomePageProps {
    const presentation = projection.publicPresentation;

    return {
        auth: projection.auth,
        appearance: projection.appearance,
        localization: {
            // The copied translation hook uses its supplied source fallback
            // when this public route has no scoped catalog projection.
            locale: 'en',
            translations: {},
        },
        publicPresentation: {
            auth: {
                backgroundImages: {
                    login: appearanceImages(presentation.auth.login),
                    register: appearanceImages(presentation.auth.register),
                    welcome: appearanceImages(presentation.auth.welcome),
                },
            },
            branding: presentation.branding,
            cursors: {
                action: cursor(presentation.cursors.action),
                default: cursor(presentation.cursors.default),
                denied: cursor(presentation.cursors.denied),
                grab: cursor(presentation.cursors.grab),
                text: cursor(presentation.cursors.text),
            },
            infoPages: {
                pages: presentation.information_pages.map((page) => ({
                    backgrounds: images(page.backgrounds),
                    key: page.slug,
                    markdown: page.body,
                    title: page.title,
                })),
            },
            publicPalette: {
                dark: publicPalette(presentation.public_palette.dark),
                light: publicPalette(presentation.public_palette.light),
            },
            welcome: {
                pages: presentation.welcome.pages.map((page) => ({
                    backgrounds: images(page.backgrounds),
                    body: page.body,
                    buttons: page.buttons,
                    eyebrow: page.eyebrow,
                    primaryLabel: page.buttons[0]?.text ?? '',
                    title: page.title,
                })),
            },
        } as PublicPresentationSettings,
    };
}

function appearanceImages(
    theme: components['schemas']['PublicAppearanceThemes'],
) {
    return {
        dark: theme.dark.background_image,
        light: theme.light.background_image,
    };
}

function cursor(value: components['schemas']['PublicCursor'] | undefined) {
    if (!value) {
        return undefined;
    }

    return {
        fallback: value.fallback,
        hotspotX: value.hotspot_x,
        hotspotY: value.hotspot_y,
        image: value.image,
        size: value.size,
    };
}

function images(value: components['schemas']['PublicAppearanceImages']) {
    return {
        dark: value.dark,
        light: value.light,
    };
}

function publicPalette(value: components['schemas']['PublicPalette']) {
    return {
        accentText: value.accent_text,
        accentTextOpacity: value.accent_text_opacity,
        bodyText: value.body_text,
        bodyTextOpacity: value.body_text_opacity,
        controlBorder: value.control_border,
        controlBorderOpacity: value.control_border_opacity,
        controlText: value.control_text,
        controlTextOpacity: value.control_text_opacity,
        headingText: value.heading_text,
        headingTextOpacity: value.heading_text_opacity,
        mutedText: value.muted_text,
        mutedTextOpacity: value.muted_text_opacity,
        welcomeOverlay: value.welcome_overlay,
        welcomeOverlayOpacity: value.welcome_overlay_opacity,
    };
}
