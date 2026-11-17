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
    soundPreferences?: {
        ambienceVolume: number;
        effectsVolume: number;
        muted: boolean;
    };
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
            settingsPalette: {
                dark: settingsPalette(presentation.settings_palette.dark),
                light: settingsPalette(presentation.settings_palette.light),
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

function settingsPalette(value: components['schemas']['SettingsPalette']) {
    return {
        accent: value.accent,
        accentOpacity: value.accent_opacity,
        accentForeground: value.accent_foreground,
        accentForegroundOpacity: value.accent_foreground_opacity,
        activeBackground: value.active_background,
        activeBackgroundOpacity: value.active_background_opacity,
        appearanceSwitchActiveBackground:
            value.appearance_switch_active_background,
        appearanceSwitchActiveBackgroundOpacity:
            value.appearance_switch_active_background_opacity,
        appearanceSwitchActiveText: value.appearance_switch_active_text,
        appearanceSwitchActiveTextOpacity:
            value.appearance_switch_active_text_opacity,
        appearanceSwitchBackground: value.appearance_switch_background,
        appearanceSwitchBackgroundOpacity:
            value.appearance_switch_background_opacity,
        appearanceSwitchInactiveText:
            value.appearance_switch_inactive_text,
        appearanceSwitchInactiveTextOpacity:
            value.appearance_switch_inactive_text_opacity,
        borderColor: value.border_color,
        borderColorOpacity: value.border_color_opacity,
        contentBackground: value.content_background,
        contentBackgroundOpacity: value.content_background_opacity,
        inputBackground: value.input_background,
        inputBackgroundOpacity: value.input_background_opacity,
        inputBorderColor: value.input_border_color,
        inputBorderColorOpacity: value.input_border_color_opacity,
        mutedText: value.muted_text,
        mutedTextOpacity: value.muted_text_opacity,
        nestedSidebarBackground: value.nested_sidebar_background,
        nestedSidebarBackgroundOpacity: value.nested_sidebar_background_opacity,
        panelBackground: value.panel_background,
        panelBackgroundOpacity: value.panel_background_opacity,
        scrollbarThumb: value.scrollbar_thumb,
        scrollbarThumbOpacity: value.scrollbar_thumb_opacity,
        sidebarBackground: value.sidebar_background,
        sidebarBackgroundOpacity: value.sidebar_background_opacity,
    };
}
