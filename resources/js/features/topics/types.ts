export type TopicSummary = {
    description: string | null;
    href: string;
    id: number;
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
    parent: TopicSummary | null;
    subtopics: TopicSummary[];
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
