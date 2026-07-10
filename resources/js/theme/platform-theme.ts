import type { CSSProperties } from 'react';
import themeJson from '@/theme/platform-theme.json?raw';

export type ThemeMode = 'dark' | 'light';
export type AuthThemePage =
    | 'confirm-password'
    | 'forgot-password'
    | 'login'
    | 'register'
    | 'reset-password'
    | 'two-factor-challenge'
    | 'verify-email'
    | 'welcome';

type AuthThemeValues = {
    backgroundColor: string;
    backgroundImage: string;
    backgroundOverlay: string;
    borderLineColor: string;
    buttonBackground: string;
    buttonTextColor: string;
    descriptionTextColor: string;
    eyebrowTextColor: string;
    focusRingColor: string;
    inputBackground: string;
    inputBorderColor: string;
    labelTextColor: string;
    linkTextColor: string;
    logoBackground: string;
    logoColor: string;
    panelBackground: string;
    titleTextColor: string;
};

type AuthThemeOverrides = Partial<AuthThemeValues> & {
    dark?: Partial<AuthThemeValues>;
    light?: Partial<AuthThemeValues>;
};

type PlatformThemeConfig = {
    auth?: {
        dark?: Partial<AuthThemeValues>;
        default?: Partial<AuthThemeValues>;
        light?: Partial<AuthThemeValues>;
        pages?: Partial<Record<AuthThemePage, AuthThemeOverrides>>;
    };
};

export type AuthTheme = AuthThemeValues;
export type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

const fallbackAuthTheme: AuthTheme = {
    backgroundColor: '#07111f',
    backgroundImage: '',
    backgroundOverlay:
        'linear-gradient(120deg, rgba(7, 17, 31, 0.94), rgba(7, 17, 31, 0.76), rgba(7, 17, 31, 0.42))',
    borderLineColor: 'rgba(94, 234, 212, 0.24)',
    buttonBackground: '#5eead4',
    buttonTextColor: '#06111f',
    descriptionTextColor: 'rgba(203, 213, 225, 0.78)',
    eyebrowTextColor: '#67e8f9',
    focusRingColor: '#67e8f9',
    inputBackground: 'rgba(2, 6, 23, 0.36)',
    inputBorderColor: 'rgba(125, 211, 252, 0.32)',
    labelTextColor: '#e2e8f0',
    linkTextColor: '#67e8f9',
    logoBackground: '#5eead4',
    logoColor: '#06111f',
    panelBackground: 'rgba(7, 17, 31, 0.82)',
    titleTextColor: '#f8fafc',
};

function readPlatformTheme(): PlatformThemeConfig {
    try {
        return JSON.parse(themeJson) as PlatformThemeConfig;
    } catch {
        return {};
    }
}

const platformTheme = readPlatformTheme();

export function getAuthTheme(page: AuthThemePage, mode: ThemeMode): AuthTheme {
    const authConfig = platformTheme.auth ?? {};
    const pageConfig = authConfig.pages?.[page] ?? {};

    return {
        ...fallbackAuthTheme,
        ...(authConfig.default ?? {}),
        ...(authConfig[mode] ?? {}),
        ...pageConfig,
        ...(pageConfig[mode] ?? {}),
    };
}

export function getAuthThemeStyle(theme: AuthTheme): ThemeStyle {
    return {
        '--auth-background-color': theme.backgroundColor,
        '--auth-background-image': theme.backgroundImage
            ? `url(${theme.backgroundImage})`
            : 'none',
        '--auth-background-overlay': theme.backgroundOverlay,
        '--auth-border-line-color': theme.borderLineColor,
        '--auth-button-background': theme.buttonBackground,
        '--auth-button-text-color': theme.buttonTextColor,
        '--auth-description-text-color': theme.descriptionTextColor,
        '--auth-eyebrow-text-color': theme.eyebrowTextColor,
        '--auth-focus-ring-color': theme.focusRingColor,
        '--auth-input-background': theme.inputBackground,
        '--auth-input-border-color': theme.inputBorderColor,
        '--auth-label-text-color': theme.labelTextColor,
        '--auth-link-text-color': theme.linkTextColor,
        '--auth-logo-background': theme.logoBackground,
        '--auth-logo-color': theme.logoColor,
        '--auth-panel-background': theme.panelBackground,
        '--auth-title-text-color': theme.titleTextColor,
        '--background': theme.inputBackground,
        '--border': theme.borderLineColor,
        '--color-background': theme.inputBackground,
        '--color-border': theme.borderLineColor,
        '--color-foreground': theme.labelTextColor,
        '--color-input': theme.inputBorderColor,
        '--color-muted-foreground': theme.descriptionTextColor,
        '--color-primary': theme.buttonBackground,
        '--color-primary-foreground': theme.buttonTextColor,
        '--color-ring': theme.focusRingColor,
        '--foreground': theme.labelTextColor,
        '--input': theme.inputBorderColor,
        '--muted-foreground': theme.descriptionTextColor,
        '--primary': theme.buttonBackground,
        '--primary-foreground': theme.buttonTextColor,
        '--ring': theme.focusRingColor,
        color: theme.labelTextColor,
    };
}
