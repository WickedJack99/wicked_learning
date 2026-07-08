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
    mapId: number;
    mapSlug: string;
    mapTitle: string;
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
        labelOpacity?: string;
        tileColor?: string;
        tileOpacity?: string;
        foregroundColor?: string;
        foregroundOpacity?: string;
        highlightColor?: string;
        highlightOpacity?: string;
        hideEmptySpace?: boolean;
        hideImage?: boolean;
        hideLabel?: boolean;
        tooltip?: string;
        imageUrl?: string;
    }>;
    outgoingPortalLinks: LearningPortalLink[];
    startActivityId: number | null;
    startRoutes: LearningActivityStart[];
    activities: LearningActivity[];
};

export type LearningActivityStart = {
    activityId: number;
    buttonBorderColorDark: string | null;
    buttonBorderColorLight: string | null;
    buttonColorDark: string | null;
    buttonColorLight: string | null;
    id: number;
    imageDark: string | null;
    imageLight: string | null;
    label: string;
    sortOrder: number;
};

export type LearningPortalLink = {
    description: string | null;
    id: number;
    label: string | null;
    sourceActivityId: number | null;
    targetActivityId: number | null;
    targetMapId: number;
    targetMapSlug: string;
    targetMapTitle: string;
    targetNodeId: number;
    targetNodeSlug: string;
    targetNodeTitle: string;
};

export type LearningActivity = {
    id: number;
    slug: string;
    type: 'dialogue' | 'question' | 'reflection' | string;
    title: string;
    introduction: string | null;
    config: Record<string, string | boolean | number | null>;
    dialogueStages: DialogueStage[];
    npcDialogueNodes: NpcDialogueNode[];
    npcDialogueTransitions: NpcDialogueTransition[];
    question: LearningQuestion | null;
    transitions: ActivityTransition[];
};

export type NpcDialogueNode = {
    body: string | null;
    config: Record<
        string,
        | Array<Record<string, boolean | number | string | null>>
        | boolean
        | number
        | string
        | null
    >;
    id: number;
    title: string;
    type: 'end' | 'npc_interaction' | string;
};

export type NpcDialogueTransition = {
    fromConnector: string;
    fromNodeId: number | null;
    id: number;
    toConnector: string;
    toNodeId: number;
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
    fromConnector: string;
    toActivityId: number | null;
    toConnector: string;
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
