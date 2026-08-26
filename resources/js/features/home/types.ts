export type LearningDeskBookmark = {
    description: string | null;
    href: string;
    id: number;
    imageUrl: string | null;
    mapTitle: string;
    nodeId: number;
    topic: { href: string; title: string } | null;
    title: string;
};

export type LearningDeskRoute = {
    currentActivityTitle: string | null;
    href: string;
    id: number;
    imageUrl: string | null;
    learningIntent: string | null;
    lastCompletedAt: string | null;
    lastEnteredAt: string | null;
    mapHref: string;
    mapTitle: string;
    nodeHref: string;
    nodeTitle: string;
    routeLabel: string | null;
    topic: { href: string; title: string } | null;
};

export type LearningDeskData = {
    bookmarks: LearningDeskBookmark[];
    connections: LearningDeskBookmark[];
    currentRoutes: LearningDeskRoute[];
    recentRoutes: LearningDeskRoute[];
    featuredBookmark: LearningDeskBookmark | null;
};

export type LearningSearchResult = {
    id: string;
    kind: 'map' | 'node';
    mapId: number;
    mapSlug: string;
    nodeId?: number;
    nodeSlug?: string;
    subtitle: string;
    title: string;
};
