import type { ActivityForm } from './edit-node-activity-types';

type ActivityFormPayload = Partial<ActivityForm>;

const coreFields: Array<keyof ActivityForm> = [
    'introduction',
    'slug',
    'title',
    'type',
];

const obstacleFields: Array<keyof ActivityForm> = [
    'obstacle_allowed_tool_ids',
    'obstacle_background_dark',
    'obstacle_background_light',
    'obstacle_background_mirrored',
    'obstacle_bubble_border_color_dark',
    'obstacle_bubble_border_color_light',
    'obstacle_bubble_color_dark',
    'obstacle_bubble_color_light',
    'obstacle_bubble_opacity_dark',
    'obstacle_bubble_opacity_light',
    'obstacle_image_dark',
    'obstacle_image_light',
    'obstacle_image_mirrored',
    'obstacle_persist_after_solved',
    'obstacle_prompt_text',
    'obstacle_width',
    'obstacle_x',
    'obstacle_y',
    'obstacle_revisit_background_dark',
    'obstacle_revisit_background_light',
    'obstacle_revisit_background_mirrored',
    'obstacle_revisit_image_dark',
    'obstacle_revisit_image_light',
    'obstacle_revisit_image_mirrored',
    'obstacle_revisit_text',
    'obstacle_success_animation',
    'obstacle_success_text',
    'obstacle_typing_speed',
];

const itemGrantFields: Array<keyof ActivityForm> = [
    'item_grant_background_dark',
    'item_grant_background_light',
    'item_grant_background_mirrored',
    'item_grant_items',
    'item_grant_probability_percent',
];

const itemObstacleFields: Array<keyof ActivityForm> = [
    'item_obstacle_background_dark',
    'item_obstacle_background_light',
    'item_obstacle_background_mirrored',
    'item_obstacle_lock_minutes',
    'item_obstacle_met_background_dark',
    'item_obstacle_met_background_light',
    'item_obstacle_met_background_mirrored',
    'item_obstacle_overlay_dark',
    'item_obstacle_overlay_light',
    'item_obstacle_overlay_mirrored',
    'item_obstacle_overlay_width',
    'item_obstacle_overlay_x',
    'item_obstacle_overlay_y',
    'item_obstacle_slots',
    'item_obstacle_consume_on_each_entry',
    'item_obstacle_sound_met_enabled',
    'item_obstacle_sound_met_id',
    'item_obstacle_sound_not_met_enabled',
    'item_obstacle_sound_not_met_id',
    'item_obstacle_sound_transition_enabled',
    'item_obstacle_sound_transition_id',
];

const markdownFields: Array<keyof ActivityForm> = [
    'markdown_graph_layout',
    'markdown_pages',
    'markdown_transitions',
];

const portalFields: Array<keyof ActivityForm> = [
    'portal_background_dark',
    'portal_background_light',
    'portal_background_mirrored',
    'portal_assets',
    'portal_duration_seconds',
    'portal_foreground_dark',
    'portal_foreground_light',
    'portal_foreground_mirrored',
    'portal_foreground_width',
    'portal_foreground_x',
    'portal_foreground_y',
    'portal_mode',
    'portal_show_on_arrival',
    'portal_swirl_enabled',
    'portal_bubble_text',
    'portal_bubble_typing_speed',
    'portal_bubble_color_dark',
    'portal_bubble_color_light',
    'portal_bubble_border_color_dark',
    'portal_bubble_border_color_light',
    'portal_bubble_text_color_dark',
    'portal_bubble_text_color_light',
    'portal_wait_for_enter',
    'target_portal_activity_id',
];

const reflectionFields: Array<keyof ActivityForm> = [
    'reflection_prompt',
    'reflection_note',
    'reflection_topic',
    'reflection_subtopic',
];

const sharedTaskFields: Array<keyof ActivityForm> = [
    'shared_task_cycle_mode',
    'shared_task_input_label',
    'shared_task_instructions',
    'shared_task_kind',
    'shared_task_minimum_length',
    'shared_task_prompt',
    'shared_task_repeat_policy',
    'shared_task_threshold',
    'shared_task_validation_mode',
];

const toolGrantFields: Array<keyof ActivityForm> = [
    'tool_grant_background_dark',
    'tool_grant_background_light',
    'tool_grant_background_mirrored',
    'tool_grant_bubble_border_color_dark',
    'tool_grant_bubble_border_color_light',
    'tool_grant_bubble_color_dark',
    'tool_grant_bubble_color_light',
    'tool_grant_bubble_opacity_dark',
    'tool_grant_bubble_opacity_light',
    'tool_grant_fade_duration_seconds',
    'tool_grant_slide_direction',
    'tool_grant_slide_duration_seconds',
    'tool_grant_text',
    'tool_grant_tool_id',
    'tool_grant_tool_mirrored',
    'tool_grant_tool_x',
    'tool_grant_tool_y',
    'tool_grant_typing_speed',
];

export function activityFormPayload(form: ActivityForm): ActivityFormPayload {
    return pick(form, [...coreFields, ...fieldsForActivityType(form.type)]);
}

function fieldsForActivityType(type: string): Array<keyof ActivityForm> {
    if (type === 'item_grant') {
        return itemGrantFields;
    }

    if (type === 'item_obstacle') {
        return itemObstacleFields;
    }

    if (type === 'obstacle') {
        return obstacleFields;
    }

    if (type === 'markdown') {
        return markdownFields;
    }

    if (type === 'portal') {
        return portalFields;
    }

    if (type === 'tool_grant') {
        return toolGrantFields;
    }

    if (type === 'reflection') {
        return reflectionFields;
    }

    if (type === 'shared_task') {
        return sharedTaskFields;
    }

    return [];
}

function pick(
    form: ActivityForm,
    fields: Array<keyof ActivityForm>,
): ActivityFormPayload {
    return Object.fromEntries(
        fields.map((field) => [field, form[field]]),
    ) as ActivityFormPayload;
}
