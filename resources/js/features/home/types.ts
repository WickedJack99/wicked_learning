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
    deskReason: 'active_route' | 'recently_completed';
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
    feeling: string | null;
    note: string | null;
    nextDirection: 'revisit' | 'related' | 'settle' | null;
    nodeHref: string;
    nodeTitle: string;
    recordedAt: string;
    topics: { name: string; slug: string }[];
};

export type LearningDeskRevisitInvitation = {
    activityHref: string;
    activityId: number;
    activityTitle: string;
    availableAfterDays: number;
    availableAt: string;
    availableSince: string;
    deskReason: 'chosen_to_return';
    mapTitle: string;
    nodeHref: string;
    nodeTitle: string;
    revisitReason: 'pause' | 'later';
};

export type LearningDeskRecallItem = {
    activityHref: string;
    activityId: number;
    activityTitle: string;
    deskReason: 'saved_for_recall';
    isDue: boolean;
    lastConfidence: string | null;
    lastConfidenceAfterFeedback: string | null;
    lastOutcome: string | null;
    lastReviewedAt: string | null;
    mapTitle: string;
    nextReviewAt: string | null;
    nodeHref: string;
    nodeTitle: string;
    prompt: string;
    questionId: number;
    reviewCount: number;
};

export type LearningDeskData = {
    bookmarks: LearningDeskBookmark[];
    checkIns: LearningDeskCheckIn[];
    connections: LearningDeskBookmark[];
    currentRoutes: LearningDeskRoute[];
    recentRoutes: LearningDeskRoute[];
    recallItems: LearningDeskRecallItem[];
    revisitInvitations: LearningDeskRevisitInvitation[];
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
