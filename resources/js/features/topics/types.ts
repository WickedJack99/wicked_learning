import type { LearningSourceReference } from '@/types/learning';

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
    competence: TopicCompetence | null;
    learningAreas: TopicLearningArea[];
    learningPulse: TopicLearningPulse[];
    reflectionNarrative: TopicReflectionNarrative | null;
    maps: TopicMapSummary[];
    parent: TopicSummary | null;
    paths: TopicPath[];
    subtopics: TopicSummary[];
    subtopicCompetence: TopicCompetence[];
};

export type TopicCompetence = {
    evidenceLedger: TopicEvidenceLedgerEntry[];
    evidenceTypes: string[];
    learningPeriods: string[];
    name: string;
    recentDescription: string;
    revisit: {
        activityHref: string;
        activityTitle: string;
        nodeTitle: string;
    } | null;
    slug: string;
    visual: {
        auraRatio: number;
        brightnessRatio: number;
        description: string;
        sizeRatio: number;
    };
    topic: {
        href: string;
        title: string;
    } | null;
};

export type TopicEvidenceLedgerEntry = {
    activityHref: string | null;
    activityTitle: string | null;
    evidenceClaim: string;
    evidenceCriterion: string | null;
    evidenceRubric: string[];
    evidenceType: string;
    sources: LearningSourceReference[];
    objective: string | null;
    concepts: string[];
    learningPurpose: string | null;
    confidence: string | null;
    outcome: string | null;
    assistanceLevel: string | null;
    id: number;
    attemptNumber: number;
    nodeTitle: string | null;
    recordedAt: string | null;
};

export type TopicLearningArea = {
    learningIntents: string[];
    name: string;
    slug: string;
};

export type TopicLearningPulse = {
    activityHref: string;
    activityId: number;
    activityTitle: string;
    feeling: string | null;
    note: string | null;
    nodeHref: string;
    nodeTitle: string;
    recordedAt: string;
    topics: { name: string; slug: string }[];
};

export type TopicReflectionNarrative = {
    earlier: TopicReflectionSnapshot;
    entries: TopicReflectionSnapshot[];
    later: TopicReflectionSnapshot;
};

export type TopicReflectionSnapshot = {
    activityTitle: string | null;
    createdAt: string | null;
    id: number;
    journalHref: string;
    question: string;
    reflection: string;
};

export type TopicPath = {
    activityTitle: string;
    activityType: string;
    description: string | null;
    href: string;
    id: number;
    imageUrl: string | null;
    learningAreas: { name: string; slug: string }[];
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
    nodeCount: number;
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
