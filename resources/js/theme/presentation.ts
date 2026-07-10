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
        grab: CursorImageSettings;
    };
    welcome: {
        pages: WelcomePageSettings[];
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
        body: 'A world can look like a cyber network, a medieval map, an astronomy field or something quiet and abstract. Themes change the story, while maps, nodes and activities keep the learning structure coherent.',
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
