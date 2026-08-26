export type TopicSummary = {
    description: string | null;
    href: string;
    id: number;
    mapCount?: number;
    slug: string;
    title: string;
};

export type TopicArea = {
    description: string | null;
    id: number;
    slug: string;
    title: string;
    topics: TopicSummary[];
};

export type TopicDetail = TopicSummary & {
    area: {
        id: number;
        slug: string;
        title: string;
    };
    content: string | null;
    maps: TopicMapSummary[];
    parent: TopicSummary | null;
    paths: TopicPath[];
    subtopics: TopicSummary[];
};

export type TopicPath = {
    activityTitle: string;
    activityType: string;
    description: string | null;
    href: string;
    id: number;
    imageUrl: string | null;
    learningIntent: string | null;
    label: string;
    mapHref: string;
    mapTitle: string;
    nodeHref: string;
    nodeTitle: string;
    progress: {
        currentActivityTitle: string | null;
        lastEnteredAt: string | null;
        status: string;
    } | null;
};

export type TopicMapSummary = {
    description: string | null;
    href: string;
    id: number;
    slug: string;
    title: string;
};

export type AdminTopic = TopicSummary & {
    content: string | null;
    isPublished: boolean;
    parentId: number | null;
};

export type AdminTopicArea = Omit<TopicArea, 'topics'> & {
    sortOrder: number;
    topics: AdminTopic[];
};
