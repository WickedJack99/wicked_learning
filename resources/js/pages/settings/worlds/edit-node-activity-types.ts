import type { Edge, Node } from '@xyflow/react';

export type Connector = {
    color?: string;
    id: string;
    label: string;
    symbol?: string;
};

export type ActivityTypeDefinition = {
    description: string;
    key: string;
    label: string;
    portalModes?: Array<{ key: string; label: string }>;
};

export type ActivitySummary = {
    config: Record<
        string,
        | Array<
              | MarkdownPageForm
              | MarkdownTransitionForm
              | PortalAssetForm
              | Record<string, unknown>
              | number
              | string
          >
        | GraphLayout
        | Record<string, unknown>
        | string
        | number
        | boolean
        | null
    >;
    connectors: {
        inputs: Connector[];
        outputs: Connector[];
    };
    graphLayout?: GraphLayout;
    id: number;
    introduction: string | null;
    portalLink: PortalActivityLink | null;
    position: {
        x: number | null;
        y: number | null;
    };
    slug: string;
    title: string;
    type: string;
};

export type CompetenceTopicForm = {
    topic: string;
    weight: string;
};

export type PortalActivityLink = {
    description: string | null;
    id: number;
    label: string | null;
    targetActivity: {
        id: number;
        mapTitle: string;
        nodeTitle: string;
        title: string;
    } | null;
    targetNode: {
        id: number;
        mapTitle: string;
        title: string;
    };
};

export type PortalCandidate = {
    id: number;
    mapId: number;
    mapTitle: string;
    nodeId: number;
    nodeTitle: string;
    title: string;
};

export type PortalAssetForm = {
    id: string;
    imageDark: string;
    imageLight: string;
    label: string;
    layer: string;
    mirrored: boolean;
    opacity: string;
    width: string;
    x: string;
    y: string;
};

export type ActivityTransitionSummary = {
    fromActivityId: number;
    fromConnector: string;
    id: number;
    label: string | null;
    toActivityId: number | null;
    toConnector: string;
    trigger: string;
};

export type ActivityGraphPayload = {
    activities: ActivitySummary[];
    activityTypes: ActivityTypeDefinition[];
    map: {
        id: number;
        slug: string;
        title: string;
    };
    node: {
        description: string | null;
        graphLayout: GraphLayout;
        id: number;
        slug: string;
        startActivityId: number | null;
        startRoutes: ActivityStartRoute[];
        title: string;
    };
    portalCandidates: PortalCandidate[];
    transitions: ActivityTransitionSummary[];
    world: {
        id: number;
        slug: string;
        title: string;
    };
};

export type GraphLayout = {
    end?: GraphPosition;
    start?: GraphPosition;
};

export type GraphPosition = {
    x: number;
    y: number;
};

export type EditableTool = {
    id: number;
    imageDark: string | null;
    imageLight: string | null;
    slug: string;
    title: string;
};

export type EditableItem = {
    id: number;
    imageDark: string | null;
    imageLight: string | null;
    quantity?: number;
    slug: string;
    title: string;
};

export type EditableSound = {
    id: number;
    name: string;
    slug: string;
    url: string;
};

export type ActivityStartRoute = {
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

export type StartRouteForm = {
    button_border_color_dark: string;
    button_border_color_light: string;
    button_color_dark: string;
    button_color_light: string;
    image_dark: string;
    image_light: string;
};

export type MarkdownPageForm = {
    body: string;
    id: string;
    position: {
        x: number;
        y: number;
    };
    title: string;
    visual: {
        borderColorDark: string;
        borderColorLight: string;
        headingColorDark: string;
        headingColorLight: string;
        pageColorDark: string;
        pageColorLight: string;
        textColorDark: string;
        textColorLight: string;
    };
};

export type MarkdownTransitionForm = {
    from: string;
    id: string;
    to: string;
};

export type ActivityNodeData = {
    activity: ActivitySummary;
    onDelete: (activity: ActivitySummary) => void;
    onEdit: (activity: ActivitySummary) => void;
};

export type SpecialNodeData = {
    description: string;
    kind: 'start' | 'end';
    title: string;
};

export type ActivityGraphNode =
    | Node<ActivityNodeData, 'activity'>
    | Node<SpecialNodeData, 'special'>;

export type ActivityGraphEdge = Edge<
    ActivityTransitionSummary | { start: true; startRouteId: number }
>;

export type CreateActivityForm = {
    competence_topics: CompetenceTopicForm[];
    introduction: string;
    item_grant_background_dark: string;
    item_grant_background_light: string;
    item_grant_background_mirrored: boolean;
    item_grant_items: Array<{
        itemId: string;
        quantity: string;
    }>;
    item_grant_probability_percent: string;
    item_obstacle_background_dark: string;
    item_obstacle_background_light: string;
    item_obstacle_background_mirrored: boolean;
    item_obstacle_lock_minutes: string;
    item_obstacle_met_background_dark: string;
    item_obstacle_met_background_light: string;
    item_obstacle_met_background_mirrored: boolean;
    item_obstacle_overlay_dark: string;
    item_obstacle_overlay_light: string;
    item_obstacle_overlay_mirrored: boolean;
    item_obstacle_overlay_width: string;
    item_obstacle_overlay_x: string;
    item_obstacle_overlay_y: string;
    item_obstacle_slots: Array<{
        itemId: string;
        width: string;
        x: string;
        y: string;
    }>;
    item_obstacle_consume_on_each_entry: boolean;
    item_obstacle_sound_met_enabled: boolean;
    item_obstacle_sound_met_id: string;
    item_obstacle_sound_not_met_enabled: boolean;
    item_obstacle_sound_not_met_id: string;
    item_obstacle_sound_transition_enabled: boolean;
    item_obstacle_sound_transition_id: string;
    markdown_pages: MarkdownPageForm[];
    markdown_graph_layout: GraphLayout;
    markdown_transitions: MarkdownTransitionForm[];
    obstacle_allowed_tool_ids: string;
    obstacle_background_dark: string;
    obstacle_background_light: string;
    obstacle_background_mirrored: boolean;
    obstacle_bubble_border_color_dark: string;
    obstacle_bubble_border_color_light: string;
    obstacle_bubble_color_dark: string;
    obstacle_bubble_color_light: string;
    obstacle_bubble_opacity_dark: string;
    obstacle_bubble_opacity_light: string;
    obstacle_image_dark: string;
    obstacle_image_light: string;
    obstacle_image_mirrored: boolean;
    obstacle_persist_after_solved: boolean;
    obstacle_prompt_text: string;
    obstacle_width: string;
    obstacle_x: string;
    obstacle_y: string;
    obstacle_revisit_background_dark: string;
    obstacle_revisit_background_light: string;
    obstacle_revisit_background_mirrored: boolean;
    obstacle_revisit_image_dark: string;
    obstacle_revisit_image_light: string;
    obstacle_revisit_image_mirrored: boolean;
    obstacle_revisit_text: string;
    obstacle_success_animation: string;
    obstacle_success_text: string;
    obstacle_typing_speed: string;
    portal_background_dark: string;
    portal_background_light: string;
    portal_background_mirrored: boolean;
    portal_assets: PortalAssetForm[];
    portal_duration_seconds: string;
    portal_foreground_dark: string;
    portal_foreground_light: string;
    portal_foreground_mirrored: boolean;
    portal_foreground_width: string;
    portal_foreground_x: string;
    portal_foreground_y: string;
    portal_mode: 'input' | 'output';
    portal_show_on_arrival: boolean;
    portal_swirl_enabled: boolean;
    portal_bubble_text: string;
    portal_bubble_typing_speed: string;
    portal_bubble_color_dark: string;
    portal_bubble_color_light: string;
    portal_bubble_border_color_dark: string;
    portal_bubble_border_color_light: string;
    portal_bubble_text_color_dark: string;
    portal_bubble_text_color_light: string;
    portal_wait_for_enter: boolean;
    reflection_note: string;
    reflection_prompt: string;
    reflection_subtopic: string;
    reflection_topic: string;
    shared_task_cycle_mode: string;
    shared_task_input_label: string;
    shared_task_instructions: string;
    shared_task_kind: string;
    shared_task_minimum_length: string;
    shared_task_prompt: string;
    shared_task_repeat_policy: string;
    shared_task_threshold: string;
    shared_task_validation_mode: string;
    slug: string;
    target_portal_activity_id: string;
    title: string;
    tool_grant_background_dark: string;
    tool_grant_background_light: string;
    tool_grant_background_mirrored: boolean;
    tool_grant_bubble_border_color_dark: string;
    tool_grant_bubble_border_color_light: string;
    tool_grant_bubble_color_dark: string;
    tool_grant_bubble_color_light: string;
    tool_grant_bubble_opacity_dark: string;
    tool_grant_bubble_opacity_light: string;
    tool_grant_fade_duration_seconds: string;
    tool_grant_slide_direction: string;
    tool_grant_slide_duration_seconds: string;
    tool_grant_text: string;
    tool_grant_tool_id: string;
    tool_grant_tool_mirrored: boolean;
    tool_grant_tool_x: string;
    tool_grant_tool_y: string;
    tool_grant_typing_speed: string;
    type: string;
};

export type ActivityForm = CreateActivityForm;
