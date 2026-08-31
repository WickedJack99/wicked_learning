export type LearningWorld = {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    themeConfig: Record<string, string>;
    maps: LearningMap[];
};

export type LearningCompanion = {
    avatarColor: string;
    avatarPositionX: number;
    avatarPositionY: number;
    avatarScale: number;
    avatarUrl: string | null;
    configuration: {
        aiEnabled: boolean;
        mode: 'guided_ai' | 'open_ai' | 'scripted' | string;
        sourceScope:
            | 'activity'
            | 'map'
            | 'node'
            | 'platform'
            | 'world'
            | string;
    };
    context: {
        actions: Array<{
            href: string;
            key: string;
            label: string;
            reason: string;
        }>;
        activity: { id: number; title: string } | null;
        map: { id: number; title: string } | null;
        node: { id: number; title: string } | null;
        playRunId: string | null;
        postAttemptAvailable: boolean;
        route: { id: number; title: string } | null;
        surface: 'activity' | 'desk' | 'world';
        topic: { id: number; title: string } | null;
        world: { id: number; title: string } | null;
    };
    dialogue: LearningCompanionDialogueGraph | null;
    displayName: string;
    enabled: boolean;
    message: string;
};

export type LearningCompanionDialogueGraph = {
    nodes: LearningCompanionDialogueNode[];
    start: string;
    version: number;
};

export type LearningCompanionDialogueNode = {
    choices?: Array<{
        action?:
            | 'continue-exploring'
            | 'current-map'
            | 'learning-desk'
            | 'topics'
            | string;
        key: string;
        label: string;
        next?: string | null;
    }>;
    capabilities?: string[];
    id: string;
    instruction?: string;
    message?: string;
    next?: string | null;
    prompt?: string;
    response_mode?: 'choice' | 'message';
    title?: string;
    type: 'ai' | 'choice' | 'end' | 'message';
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
    topic: {
        competenceHref: string;
        href: string;
        slug: string;
        title: string;
    } | null;
    backgroundConfig: ThemeVariant<{
        accentColor?: string;
        assets?: MapVisualAsset[];
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
    mapAssets?: MapAsset[];
    mapAssetsLocked?: boolean;
    nodes: LearningNode[];
};

export type MapAsset = {
    id: number;
    nodeId: number | null;
    imageUrl: string | null;
    text: string | null;
    x: number;
    y: number;
    z: number;
    width: number;
    opacity: number;
    locked: boolean;
    focusable: boolean;
    interactionMode: MapAssetInteractionMode;
    interactionConfig: MapAssetInteractionConfig;
    visualConfig: Record<string, unknown>;
    soundConfig: Record<string, unknown>;
};

export type MapAssetInteractionMode =
    | 'focusable'
    | 'decorative'
    | 'hide_on_hover'
    | 'toggle';

export type MapAssetStateSprite = {
    imageUrl?: string | null;
    width?: number;
    x?: number;
    y?: number;
};

export type MapAssetInteractionConfig = {
    states?: {
        first?: MapAssetStateSprite;
        second?: MapAssetStateSprite;
    };
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
    topic: {
        competenceHref: string;
        href: string;
        slug: string;
        title: string;
    } | null;
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
        icon?: string;
        label?: string;
        labelColor?: string;
        labelOpacity?: string;
        borderColor?: string;
        borderOpacity?: string;
        highlightBorderColor?: string;
        highlightBorderOpacity?: string;
        highlightedLabelColor?: string;
        highlightedLabelOpacity?: string;
        tileColor?: string;
        tileOpacity?: string;
        foregroundColor?: string;
        foregroundOpacity?: string;
        highlightColor?: string;
        highlightOpacity?: string;
        highlightImageEnabled?: boolean;
        highlightImageUrl?: string;
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
            isItemUnlockable?: boolean;
            isToolUnlockable?: boolean;
            itemOwned?: boolean;
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
            requirements?: LearningUnlockRequirement;
        };
        tooltip?: string;
        imageUrl?: string;
    }>;
    outgoingPortalLinks: LearningPortalLink[];
    startActivityId: number | null;
    startRoutes: LearningActivityStart[];
    activities: LearningActivity[];
};

export type LearningUnlockRequirement = {
    type:
        | 'group'
        | 'item_owned'
        | 'node_completed'
        | 'role_has'
        | 'time_after'
        | 'tool_used';
    operator?: 'and' | 'or';
    requirements?: LearningUnlockRequirement[];
    mapSlug?: string | null;
    nodeSlug?: string | null;
    nodeTitle?: string | null;
    roleSlug?: string | null;
    roleTitle?: string | null;
    itemTitle?: string | null;
    toolTitle?: string | null;
    availableAt?: string | null;
    satisfied: boolean;
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
    type: 'question' | 'reflection' | 'review' | string;
    title: string;
    introduction: string | null;
    timeGuideMinutes: number | null;
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
    dialogueTypingSoundSets: DialogueTypingSoundSet[];
    sources: LearningSourceReference[];
    completionChoicePrompt: string | null;
    feedbackGuidance: LearningFeedbackGuidance | null;
    npcDialogueNodes: NpcDialogueNode[];
    npcDialogueTransitions: NpcDialogueTransition[];
    question: LearningQuestion | null;
    reviewContext: Array<{
        createdAt: string | null;
        id: number;
        question: string;
        reflection: string;
    }> | null;
    sharedTaskState: SharedTaskState | null;
    transitions: ActivityTransition[];
};

export type LearningFeedbackGuidance = {
    evidence: string | null;
    nextAction: string | null;
    purpose: string | null;
    responseFeedback?: string;
    independentCheckPrompt?: string;
    independentCheckFeedback?: string;
    rubric?: string[];
};

export type LearningSourceReference = {
    anchor: string | null;
    concepts?: string[];
    excerpt: string | null;
    publishedAt: string | null;
    publisher: string | null;
    rights: string | null;
    title: string;
    url: string;
};

export type SharedTaskState = {
    acceptedCount: number;
    threshold: number;
    remaining: number;
    isComplete: boolean;
    latestSubmissionAt: string | null;
    canShareContributions: boolean;
    hasSubmitted: boolean;
    contributions: Array<{
        body: string;
        projectStep: string | null;
        submittedAt: string | null;
        taskKind: string;
        truncated: boolean;
    }>;
    peerReview: {
        enabled: boolean;
        prompt: string;
        hasReviewed: boolean;
        reviewableContributions: Array<{
            id: number;
            body: string;
            projectStep: string | null;
            taskKind: string;
            truncated: boolean;
        }>;
        receivedReviews: Array<{
            id: number;
            body: string;
            projectStep: string | null;
            responseType: string | null;
            canMarkHelpful: boolean;
            isHelpful: boolean;
            createdAt: string | null;
        }>;
    } | null;
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

export type DialogueTypingSound = {
    id: number;
    letter: string;
    url: string;
    volume: number;
};

export type DialogueTypingSoundSet = {
    id: number;
    isDefault: boolean;
    name: string;
    sounds: Record<string, DialogueTypingSound>;
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
    recallQuestionIds: number[];
};

export type LearningCheckInFeeling =
    | 'clearer'
    | 'forming'
    | 'stretched'
    | 'stuck';

export type LearningCheckInNextDirection = 'revisit' | 'related' | 'settle';

export type QuestionAnswerProgress = {
    optionId: number | null;
    optionIds: number[];
    isCorrect: boolean;
    attemptNumber?: number;
    confidence?: QuestionConfidence | null;
    calibration?: QuestionCalibration | null;
    earlierAttempts?: QuestionAnswerAttempt[];
    feedback: string | null;
    explanation?: string | null;
    nextActivityId?: number | null;
    recall?: {
        intervalDays: number;
        nextReviewAt: string;
    } | null;
};

export type QuestionAnswerAttempt = {
    answeredAt: string | null;
    calibration?: QuestionCalibration | null;
    confidence: QuestionConfidence | null;
    isCorrect: boolean;
    optionLabel: string | null;
    optionLabels?: string[];
};

export type QuestionConfidence = 'exploring' | 'leaning' | 'settled';

export type ReviewOutcome = 'clearer' | 'connected' | 'open';

export type ReviewResponseType = 'reflection' | 'explain' | 'transfer';

export type ActivityCompletionOutcome = ReviewOutcome | 'correct' | 'incorrect';

export type QuestionCalibration =
    | 'aligned'
    | 'stronger_than_expected'
    | 'higher_than_result'
    | 'uncertainty_made_gap_visible';
