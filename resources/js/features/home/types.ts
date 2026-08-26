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
    learningAreas: { name: string; slug: string }[];
    learningIntent: string | null;
    lastCompletedAt: string | null;
    lastEnteredAt: string | null;
    mapHref: string;
    mapTitle: string;
    nodeHref: string;
    nodeTitle: string;
    routeLabel: string | null;
    topic: { href: string; slug: string; title: string } | null;
};

export type LearningDeskCheckIn = {
    activityHref: string;
    activityId: number;
    activityTitle: string;
    feeling: string;
    nodeHref: string;
    nodeTitle: string;
    recordedAt: string;
    topics: { name: string; slug: string }[];
};

export type LearningDeskData = {
    bookmarks: LearningDeskBookmark[];
    checkIns: LearningDeskCheckIn[];
    connections: LearningDeskBookmark[];
    currentRoutes: LearningDeskRoute[];
    recentRoutes: LearningDeskRoute[];
    featuredBookmark: LearningDeskBookmark | null;
};

export type LearningSearchResult = {
    href: string;
    id: string;
    kind: 'map' | 'node' | 'topic';
    mapId?: number;
    mapSlug?: string;
    nodeId?: number;
    nodeSlug?: string;
    subtitle: string;
    title: string;
};
