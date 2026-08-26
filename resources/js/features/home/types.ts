export type LearningDeskBookmark = {
    description: string | null;
    href: string;
    id: number;
    imageUrl: string | null;
    mapTitle: string;
    nodeId: number;
    title: string;
};

export type LearningDeskRoute = {
    currentActivityTitle: string | null;
    href: string;
    id: number;
    imageUrl: string | null;
    lastEnteredAt: string | null;
    mapTitle: string;
    nodeTitle: string;
    routeLabel: string | null;
};

export type LearningDeskData = {
    bookmarks: LearningDeskBookmark[];
    connections: LearningDeskBookmark[];
    currentRoutes: LearningDeskRoute[];
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
