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
    accessRoles: string[];
    id: number;
    slug: string;
    title: string;
    description: string | null;
    backgroundConfig: ThemeVariant<{
        accentColor?: string;
        assets?: MapVisualAsset[];
        bottomNavActiveBackground?: string;
        bottomNavActiveIconColor?: string;
        bottomNavActiveTextColor?: string;
        bottomNavBackground?: string;
        bottomNavBorderColor?: string;
        bottomNavExitIconColor?: string;
        bottomNavIconColor?: string;
        bottomNavTextColor?: string;
        cardBackground?: string;
        cardBorderColor?: string;
        cardTextColor?: string;
        completedDimOpacity?: string;
        imageUrl?: string;
        overlay?: string;
        cursor?: string;
        draggingCursor?: string;
        tileCursor?: string;
        panelBackground?: string;
        panelBorderColor?: string;
        panelMutedTextColor?: string;
        panelTextColor?: string;
        pageBackground?: string;
        sideControlActiveBackground?: string;
        sideControlActiveIconColor?: string;
        sideControlActiveTextColor?: string;
        sideControlBackground?: string;
        sideControlBorderColor?: string;
        sideControlIconColor?: string;
        sideControlTextColor?: string;
        sidePanelBackground?: string;
        sidePanelBorderColor?: string;
        sidePanelHeadingColor?: string;
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

export type MapVisualAsset = {
    id?: string;
    imageUrl?: string;
    opacity?: number | string;
    width?: number | string;
    x?: number | string;
    y?: number | string;
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
        imageRotation?: string;
        imageWidth?: string;
        imageX?: string;
        imageY?: string;
        hideEmptySpace?: boolean;
        hideImage?: boolean;
        hideLabel?: boolean;
        reveal?: {
            enabled?: boolean;
            isDiscoverable?: boolean;
            isDiscovered?: boolean;
            toolId?: string;
        };
        schedule?: {
            lockAt?: string;
            unlockAt?: string;
        };
        sounds?: {
            click?: {
                enabled?: boolean;
                url?: string;
            };
            mouseEnter?: {
                enabled?: boolean;
                url?: string;
            };
            mouseLeave?: {
                enabled?: boolean;
                url?: string;
            };
            unlock?: {
                enabled?: boolean;
                url?: string;
            };
        };
        unlock?: {
            enabled?: boolean;
            isToolUnlockable?: boolean;
            isUnlockable?: boolean;
            isUnlocked?: boolean;
            nodeOperator?: 'and' | 'or';
            requiredNodeIds?: string[];
            rules?: Record<string, unknown>;
            tool?: {
                enabled?: boolean;
                toolId?: string;
            };
            toolUsed?: boolean;
            topOperator?: 'and' | 'or';
        };
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
    progress: LearningRouteProgress | null;
    sortOrder: number;
};

export type LearningRouteProgress = {
    completionCount: number;
    currentActivityId: number | null;
    lastCompletedAt: string | null;
    lastEnteredAt: string | null;
    playRunId: string | null;
    status: 'completed' | 'in_progress' | 'not_started' | string;
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
    targetNodeState: LearningNode['state'];
    targetNodeTitle: string;
};

export type LearningActivity = {
    id: number;
    slug: string;
    type: 'dialogue' | 'question' | 'reflection' | string;
    title: string;
    introduction: string | null;
    config: Record<
        string,
        | Array<Record<string, unknown> | number | string>
        | boolean
        | number
        | string
        | null
    >;
    configuredItems: LearningItem[];
    configuredSounds: LearningSound[];
    configuredTool: LearningTool | null;
    dialogueStages: DialogueStage[];
    npcDialogueNodes: NpcDialogueNode[];
    npcDialogueTransitions: NpcDialogueTransition[];
    question: LearningQuestion | null;
    transitions: ActivityTransition[];
};

export type LearningTool = {
    animationDark: string | null;
    animationLight: string | null;
    config: Record<string, boolean | number | string | null>;
    description: string | null;
    id: number;
    imageDark: string | null;
    imageLight: string | null;
    slug: string;
    title: string;
};

export type LearningItem = {
    config: Record<string, boolean | number | string | null>;
    description: string | null;
    id: number;
    imageDark: string | null;
    imageLight: string | null;
    quantity: number;
    slug: string;
    title: string;
};

export type LearningSound = {
    icon: 'ambience' | 'music' | 'sfx' | 'ui' | 'voice' | string;
    id: number;
    loop: boolean;
    name: string;
    playSeconds: number | null;
    slug: string;
    url: string;
    volume: number;
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
    type: 'answer' | 'end' | 'npc_monologue' | 'npc_question' | string;
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
    activities: Record<
        number,
        {
            status: string;
            completedAt: string | null;
            metadata?: Record<string, unknown>;
        }
    >;
    answers: Record<number, QuestionAnswerProgress>;
};

export type QuestionAnswerProgress = {
    optionId: number | null;
    isCorrect: boolean;
    feedback: string | null;
    explanation?: string | null;
    nextActivityId?: number | null;
};
