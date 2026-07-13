import type { CSSProperties } from 'react';
import type { AuthThemePage, ThemeMode } from '@/theme/platform-theme';

export type WelcomePageSettings = {
    backgrounds?: BackgroundImageSettings;
    body: string;
    buttons?: WelcomePageButtonSettings[];
    eyebrow: string;
    primaryLabel: string;
    title: string;
};

export type WelcomePageButtonSettings = {
    target: string;
    text: string;
};

export type BackgroundImageSettings = {
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

export type PlatformInformationPageSettings = {
    backgrounds?: BackgroundImageSettings;
    key: string;
    markdown: string;
    title: string;
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
    infoPages?: {
        pages: PlatformInformationPageSettings[];
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
        buttons: [
            {
                text: 'Enter the first world',
                target: '/world',
            },
            {
                text: 'Continue learning',
                target: '/login',
            },
        ],
        backgrounds: {
            dark: null,
            light: null,
        },
    },
    {
        eyebrow: 'Self-Determination Theory',
        title: 'Motivation without pressure loops',
        body: 'The platform is designed around autonomy, competence and relatedness. The interface should invite learners to choose, understand, retry and connect instead of chasing external rewards.',
        primaryLabel: 'Read about the concept',
        buttons: [
            {
                text: 'Read about the concept',
                target: '/about',
            },
        ],
        backgrounds: {
            dark: null,
            light: null,
        },
    },
    {
        eyebrow: 'Configurable worlds',
        title: 'One learning model, many stories',
        body: 'A world can look like a forest path, a medieval map, an astronomy field, a workshop or something quiet and abstract. Themes change the story, while maps, nodes and activities keep the learning structure coherent.',
        primaryLabel: 'Explore the first map',
        buttons: [
            {
                text: 'Explore the first map',
                target: '/world',
            },
        ],
        backgrounds: {
            dark: null,
            light: null,
        },
    },
];

export const defaultPlatformInformationPages: PlatformInformationPageSettings[] =
    [
        {
            key: 'about',
            title: 'About',
            markdown: `# About Learning Worlds

Learning Worlds is an open-source experiment in building a learning environment around curiosity, autonomy, competence and meaningful progress instead of points, streaks or leaderboards.

## Self-Determination Theory

Self-Determination Theory describes three basic psychological needs: autonomy, competence and relatedness. This platform uses that lens as a design compass: learners should feel agency, understand their progress and meet content through meaningful interaction rather than pressure loops.

## The current concept

The project explores world maps, nodes, activities, dialogue, questions, reflection and configurable visual themes. A deployment should be able to tell a historical, fantasy, astronomy, craft-practice or completely abstract story without changing the underlying learning model.`,
            backgrounds: {
                dark: null,
                light: null,
            },
        },
        {
            key: 'imprint',
            title: 'Imprint',
            markdown: `# Imprint

This page is a placeholder for deployment-specific publisher information.

## Responsible party

Add the legal name, address and contact details of the person or organization responsible for the deployed instance.`,
            backgrounds: {
                dark: null,
                light: null,
            },
        },
        {
            key: 'data-protection',
            title: 'Data Protection',
            markdown: `# Data Protection

This page is a placeholder for deployment-specific privacy and data protection information.

## Learning data

The platform is intended to use learning progress only where it helps learners continue, reflect or receive useful feedback. Deployments should document which activity, answer and progress data is stored.`,
            backgrounds: {
                dark: null,
                light: null,
            },
        },
    ];

export function getWelcomePages(
    presentation?: PublicPresentationSettings | null,
): WelcomePageSettings[] {
    const pages = presentation?.welcome.pages;

    if (!pages?.length) {
        return defaultWelcomePages;
    }

    return pages.map((page, index) => normalizeWelcomePage(page, index));
}

export function getPlatformInformationPages(
    presentation?: PublicPresentationSettings | null,
): PlatformInformationPageSettings[] {
    const pages = presentation?.infoPages?.pages;

    if (!pages?.length) {
        return defaultPlatformInformationPages;
    }

    return pages.map((page, index) => ({
        ...defaultPlatformInformationPages[
            index % defaultPlatformInformationPages.length
        ],
        ...page,
        backgrounds: {
            ...defaultPlatformInformationPages[
                index % defaultPlatformInformationPages.length
            ].backgrounds,
            ...(page.backgrounds ?? {}),
        },
    }));
}

export function getPlatformInformationLinks(
    presentation?: PublicPresentationSettings | null,
): Array<{ href: string; key: string; label: string }> {
    return getPlatformInformationPages(presentation).map((page) => ({
        href: platformInformationHref(page.key),
        key: page.key,
        label: page.title,
    }));
}

export function getPlatformInformationPage(
    presentation: PublicPresentationSettings | null | undefined,
    key: string,
): PlatformInformationPageSettings | null {
    return (
        getPlatformInformationPages(presentation).find(
            (page) => page.key === key,
        ) ?? null
    );
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

export function getWelcomePageBackgroundImage(
    presentation: PublicPresentationSettings | null | undefined,
    page: WelcomePageSettings,
    mode: ThemeMode,
): string | null {
    const pageBackground = page.backgrounds?.[mode] || page.backgrounds?.dark;

    return (
        pageBackground ||
        getPresentationBackgroundImage(presentation, 'welcome', mode)
    );
}

export function getPlatformInformationBackgroundImage(
    presentation: PublicPresentationSettings | null | undefined,
    page: PlatformInformationPageSettings | null,
    mode: ThemeMode,
): string | null {
    const pageBackground = page?.backgrounds?.[mode] || page?.backgrounds?.dark;

    return (
        pageBackground ||
        getPresentationBackgroundImage(presentation, 'welcome', mode)
    );
}

export function platformInformationHref(key: string): string {
    if (key === 'about' || key === 'imprint' || key === 'data-protection') {
        return `/${key}`;
    }

    return `/info/${key}`;
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
        '--public-accent': palette.accentText,
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

function normalizeWelcomePage(
    page: WelcomePageSettings,
    index: number,
): WelcomePageSettings {
    const fallback = defaultWelcomePages[index % defaultWelcomePages.length];
    const buttons =
        page.buttons && page.buttons.length
            ? page.buttons
            : [
                  {
                      text: page.primaryLabel || fallback.primaryLabel,
                      target: fallback.buttons?.[0]?.target ?? '/world',
                  },
              ];

    return {
        ...fallback,
        ...page,
        buttons,
        backgrounds: {
            ...fallback.backgrounds,
            ...(page.backgrounds ?? {}),
        },
    };
}
