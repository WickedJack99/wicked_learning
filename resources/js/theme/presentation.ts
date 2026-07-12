import type { CSSProperties } from 'react';
import type { AuthThemePage, ThemeMode } from '@/theme/platform-theme';

export type WelcomePageSettings = {
    body: string;
    eyebrow: string;
    primaryLabel: string;
    title: string;
};

type BackgroundImageSettings = {
    dark?: string | null;
    light?: string | null;
};

export type CursorImageSettings = {
    fallback?: string | null;
    hotspotX?: number | null;
    hotspotY?: number | null;
    image?: string | null;
    size?: number | null;
};

export type PublicPaletteModeSettings = {
    accentText: string;
    bodyText: string;
    controlBorder: string;
    controlText: string;
    headingText: string;
    mutedText: string;
};

export type SourceLinkSettings = {
    label: string;
    url: string;
};

export type PublicPresentationSettings = {
    auth: {
        backgroundImages: {
            login: BackgroundImageSettings;
            register: BackgroundImageSettings;
            welcome: BackgroundImageSettings;
        };
    };
    cursors: {
        action: CursorImageSettings;
        default: CursorImageSettings;
        denied: CursorImageSettings;
        grab: CursorImageSettings;
        text: CursorImageSettings;
    };
    welcome: {
        pages: WelcomePageSettings[];
    };
    publicPalette: {
        dark: PublicPaletteModeSettings;
        light: PublicPaletteModeSettings;
    };
    sourceLinks: {
        custom: SourceLinkSettings[];
        origin: SourceLinkSettings;
    };
};

export const defaultWelcomePages: WelcomePageSettings[] = [
    {
        eyebrow: 'Explorable learning platform',
        title: 'Learning Worlds',
        body: 'A first slice of a domain-agnostic learning environment built around exploration, dialogue, reflection and useful feedback instead of points, streaks or leaderboards.',
        primaryLabel: 'Enter the first world',
    },
    {
        eyebrow: 'Self-Determination Theory',
        title: 'Motivation without pressure loops',
        body: 'The platform is designed around autonomy, competence and relatedness. The interface should invite learners to choose, understand, retry and connect instead of chasing external rewards.',
        primaryLabel: 'Read about the concept',
    },
    {
        eyebrow: 'Configurable worlds',
        title: 'One learning model, many stories',
        body: 'A world can look like a forest path, a medieval map, an astronomy field, a workshop or something quiet and abstract. Themes change the story, while maps, nodes and activities keep the learning structure coherent.',
        primaryLabel: 'Explore the first map',
    },
];

export function getWelcomePages(
    presentation?: PublicPresentationSettings | null,
): WelcomePageSettings[] {
    const pages = presentation?.welcome.pages;

    if (!pages?.length) {
        return defaultWelcomePages;
    }

    return pages.map((page, index) => ({
        ...defaultWelcomePages[index % defaultWelcomePages.length],
        ...page,
    }));
}

export function getPresentationBackgroundImage(
    presentation: PublicPresentationSettings | null | undefined,
    page: AuthThemePage,
    mode: ThemeMode,
): string | null {
    const pageKey = page === 'register' || page === 'login' ? page : 'welcome';
    const images = presentation?.auth.backgroundImages[pageKey];

    return images?.[mode] || images?.dark || null;
}

export function getPublicPresentationPalette(
    presentation: PublicPresentationSettings | null | undefined,
    mode: ThemeMode,
): PublicPaletteModeSettings {
    const fallback = defaultPublicPalette[mode];

    return {
        ...fallback,
        ...(presentation?.publicPalette?.[mode] ?? {}),
    };
}

export function getPublicPresentationStyle(
    presentation: PublicPresentationSettings | null | undefined,
    mode: ThemeMode,
): CSSProperties {
    const palette = getPublicPresentationPalette(presentation, mode);

    return {
        '--public-accent-text': palette.accentText,
        '--public-body-text': palette.bodyText,
        '--public-control-border': palette.controlBorder,
        '--public-control-text': palette.controlText,
        '--public-heading-text': palette.headingText,
        '--public-muted-text': palette.mutedText,
    } as CSSProperties;
}

export const defaultPublicPalette: Record<
    ThemeMode,
    PublicPaletteModeSettings
> = {
    dark: {
        accentText: '#5eead4',
        bodyText: '#cbd5e1',
        controlBorder: '#ffffff',
        controlText: '#ffffff',
        headingText: '#f8fafc',
        mutedText: '#94a3b8',
    },
    light: {
        accentText: '#0891b2',
        bodyText: '#475569',
        controlBorder: '#0f172a',
        controlText: '#0f172a',
        headingText: '#0f172a',
        mutedText: '#334155',
    },
};
