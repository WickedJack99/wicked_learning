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
    'obstacle_bubble_border_color_dark',
    'obstacle_bubble_border_color_light',
    'obstacle_bubble_color_dark',
    'obstacle_bubble_color_light',
    'obstacle_bubble_opacity_dark',
    'obstacle_bubble_opacity_light',
    'obstacle_image_dark',
    'obstacle_image_light',
    'obstacle_persist_after_solved',
    'obstacle_prompt_text',
    'obstacle_width',
    'obstacle_x',
    'obstacle_y',
    'obstacle_revisit_background_dark',
    'obstacle_revisit_background_light',
    'obstacle_revisit_image_dark',
    'obstacle_revisit_image_light',
    'obstacle_revisit_text',
    'obstacle_success_animation',
    'obstacle_success_text',
    'obstacle_typing_speed',
];

const portalFields: Array<keyof ActivityForm> = [
    'portal_background_dark',
    'portal_background_light',
    'portal_duration_seconds',
    'portal_foreground_dark',
    'portal_foreground_light',
    'portal_foreground_x',
    'portal_foreground_y',
    'portal_mode',
    'portal_swirl_enabled',
    'target_portal_activity_id',
];

const toolGrantFields: Array<keyof ActivityForm> = [
    'tool_grant_background_dark',
    'tool_grant_background_light',
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
    'tool_grant_tool_x',
    'tool_grant_tool_y',
    'tool_grant_typing_speed',
];

export function activityFormPayload(form: ActivityForm): ActivityFormPayload {
    return pick(form, [...coreFields, ...fieldsForActivityType(form.type)]);
}

function fieldsForActivityType(type: string): Array<keyof ActivityForm> {
    if (type === 'obstacle') {
        return obstacleFields;
    }

    if (type === 'portal') {
        return portalFields;
    }

    if (type === 'tool_grant') {
        return toolGrantFields;
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
