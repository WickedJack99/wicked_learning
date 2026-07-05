export type LearningWorld = {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    themeConfig: Record<string, string>;
    maps: LearningMap[];
};

type ThemeVariant<T> = T & {
    dark?: Partial<T>;
    light?: Partial<T>;
};

export type LearningMap = {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    backgroundConfig: ThemeVariant<{
        accentColor?: string;
        cardBackground?: string;
        cardBorderColor?: string;
        cardTextColor?: string;
        imageUrl?: string;
        overlay?: string;
        cursor?: string;
        draggingCursor?: string;
        tileCursor?: string;
        panelBackground?: string;
        panelMutedTextColor?: string;
        panelTextColor?: string;
        pageBackground?: string;
        sidePanelBackground?: string;
        sidePanelBorderColor?: string;
        sidePanelMutedTextColor?: string;
        sidePanelTextColor?: string;
    }>;
    gridConfig: {
        tileWidth?: number;
        tileHeight?: number;
        gap?: number;
    };
    nodes: LearningNode[];
};

export type LearningNode = {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    position: {
        q: number;
        r: number;
    };
    state:
        | 'active'
        | 'available'
        | 'completed'
        | 'hidden'
        | 'hinted'
        | 'locked'
        | 'recommended';
    visualConfig: ThemeVariant<{
        borderColor?: string;
        icon?: string;
        label?: string;
        labelColor?: string;
        tileColor?: string;
        foregroundColor?: string;
        highlightColor?: string;
        tooltip?: string;
    }>;
    startActivityId: number | null;
    activities: LearningActivity[];
};

export type LearningActivity = {
    id: number;
    slug: string;
    type: 'dialogue' | 'question' | 'reflection' | string;
    title: string;
    introduction: string | null;
    config: Record<string, string | boolean | number | null>;
    dialogueStages: DialogueStage[];
    question: LearningQuestion | null;
    transitions: ActivityTransition[];
};

export type DialogueStage = {
    id: number;
    key: string;
    speakerName: string;
    speakerRole: string | null;
    body: string;
    portraitUrl: string | null;
    imageAlt: string | null;
    mood: string | null;
    visualConfig: Record<string, string>;
};

export type LearningQuestion = {
    id: number;
    prompt: string;
    allowMultiple: boolean;
    options: LearningQuestionOption[];
};

export type LearningQuestionOption = {
    id: number;
    label: string;
    body: string;
    outcomeKey: string | null;
    weights: Record<string, number>;
};

export type ActivityTransition = {
    id: number;
    toActivityId: number | null;
    trigger: string;
    triggerValue: string | null;
    label: string | null;
};

export type LearningProgress = {
    activities: Record<number, { status: string; completedAt: string | null }>;
    answers: Record<number, QuestionAnswerProgress>;
};

export type QuestionAnswerProgress = {
    optionId: number | null;
    isCorrect: boolean;
    feedback: string | null;
    explanation?: string | null;
    nextActivityId?: number | null;
};
