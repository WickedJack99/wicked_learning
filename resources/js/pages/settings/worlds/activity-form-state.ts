import type {
    ActivityForm,
    ActivitySummary,
    CreateActivityForm,
} from './edit-node-activity-types';
export function emptyCreateForm(type: string): CreateActivityForm {
    return {
        introduction: '',
        obstacle_allowed_tool_ids: '',
        obstacle_background_dark: '',
        obstacle_background_light: '',
        obstacle_bubble_border_color_dark: '#2dd4bf',
        obstacle_bubble_border_color_light: '#0891b2',
        obstacle_bubble_color_dark: '#0f172a',
        obstacle_bubble_color_light: '#ffffff',
        obstacle_bubble_opacity_dark: '92',
        obstacle_bubble_opacity_light: '94',
        obstacle_image_dark: '',
        obstacle_image_light: '',
        obstacle_persist_after_solved: true,
        obstacle_prompt_text: '',
        obstacle_width: '28',
        obstacle_x: '50',
        obstacle_y: '50',
        obstacle_revisit_background_dark: '',
        obstacle_revisit_background_light: '',
        obstacle_revisit_image_dark: '',
        obstacle_revisit_image_light: '',
        obstacle_revisit_text: '',
        obstacle_success_animation: 'zoom',
        obstacle_success_text: '',
        obstacle_typing_speed: '24',
        portal_background_dark: '',
        portal_background_light: '',
        portal_duration_seconds: '1.5',
        portal_foreground_dark: '',
        portal_foreground_light: '',
        portal_foreground_x: '50',
        portal_foreground_y: '50',
        portal_mode: 'output',
        portal_swirl_enabled: true,
        slug: '',
        target_portal_activity_id: '',
        title: '',
        tool_grant_background_dark: '',
        tool_grant_background_light: '',
        tool_grant_bubble_border_color_dark: '#2dd4bf',
        tool_grant_bubble_border_color_light: '#0891b2',
        tool_grant_bubble_color_dark: '#0f172a',
        tool_grant_bubble_color_light: '#ffffff',
        tool_grant_bubble_opacity_dark: '92',
        tool_grant_bubble_opacity_light: '94',
        tool_grant_fade_duration_seconds: '0.4',
        tool_grant_slide_direction: 'left',
        tool_grant_slide_duration_seconds: '0.6',
        tool_grant_text: '',
        tool_grant_tool_id: '',
        tool_grant_tool_x: '50',
        tool_grant_tool_y: '50',
        tool_grant_typing_speed: '24',
        type,
    };
}

export function activityFormFromActivity(
    activity: ActivitySummary,
    fallbackType: string,
): ActivityForm {
    const portalMode = activity.config.portalMode;

    return {
        introduction: activity.introduction ?? '',
        obstacle_allowed_tool_ids: arrayConfig(
            activity.config.allowedToolIds,
        ).join(', '),
        obstacle_background_dark: stringConfig(activity.config.backgroundDark),
        obstacle_background_light: stringConfig(
            activity.config.backgroundLight,
        ),
        obstacle_bubble_border_color_dark: stringConfig(
            activity.config.bubbleBorderColorDark,
            '#2dd4bf',
        ),
        obstacle_bubble_border_color_light: stringConfig(
            activity.config.bubbleBorderColorLight,
            '#0891b2',
        ),
        obstacle_bubble_color_dark: stringConfig(
            activity.config.bubbleColorDark,
            '#0f172a',
        ),
        obstacle_bubble_color_light: stringConfig(
            activity.config.bubbleColorLight,
            '#ffffff',
        ),
        obstacle_bubble_opacity_dark: stringConfig(
            activity.config.bubbleOpacityDark,
            '92',
        ),
        obstacle_bubble_opacity_light: stringConfig(
            activity.config.bubbleOpacityLight,
            '94',
        ),
        obstacle_image_dark: stringConfig(activity.config.obstacleImageDark),
        obstacle_image_light: stringConfig(activity.config.obstacleImageLight),
        obstacle_persist_after_solved: booleanConfig(
            activity.config.persistAfterSolved,
            true,
        ),
        obstacle_prompt_text: stringConfig(activity.config.promptText),
        obstacle_width: stringConfig(activity.config.obstacleWidth, '28'),
        obstacle_x: stringConfig(activity.config.obstacleX, '50'),
        obstacle_y: stringConfig(activity.config.obstacleY, '50'),
        obstacle_revisit_background_dark: stringConfig(
            activity.config.revisitBackgroundDark,
        ),
        obstacle_revisit_background_light: stringConfig(
            activity.config.revisitBackgroundLight,
        ),
        obstacle_revisit_image_dark: stringConfig(
            activity.config.revisitImageDark,
        ),
        obstacle_revisit_image_light: stringConfig(
            activity.config.revisitImageLight,
        ),
        obstacle_revisit_text: stringConfig(activity.config.revisitText),
        obstacle_success_animation: stringConfig(
            activity.config.successAnimation,
            'zoom',
        ),
        obstacle_success_text: stringConfig(activity.config.successText),
        obstacle_typing_speed: stringConfig(activity.config.typingSpeed, '24'),
        portal_background_dark: stringConfig(
            activity.config.portalBackgroundDark,
        ),
        portal_background_light: stringConfig(
            activity.config.portalBackgroundLight,
        ),
        portal_duration_seconds: stringConfig(
            activity.config.portalDurationSeconds,
            '1.5',
        ),
        portal_foreground_dark: stringConfig(
            activity.config.portalForegroundDark,
        ),
        portal_foreground_light: stringConfig(
            activity.config.portalForegroundLight,
        ),
        portal_foreground_x: stringConfig(
            activity.config.portalForegroundX,
            '50',
        ),
        portal_foreground_y: stringConfig(
            activity.config.portalForegroundY,
            '50',
        ),
        portal_mode: portalMode === 'input' ? 'input' : 'output',
        portal_swirl_enabled: activity.config.portalSwirlEnabled !== false,
        slug: activity.slug,
        target_portal_activity_id:
            activity.portalLink?.targetActivity?.id.toString() ?? '',
        title: activity.title,
        tool_grant_background_dark: stringConfig(
            activity.config.backgroundDark,
        ),
        tool_grant_background_light: stringConfig(
            activity.config.backgroundLight,
        ),
        tool_grant_bubble_border_color_dark: stringConfig(
            activity.config.bubbleBorderColorDark,
            '#2dd4bf',
        ),
        tool_grant_bubble_border_color_light: stringConfig(
            activity.config.bubbleBorderColorLight,
            '#0891b2',
        ),
        tool_grant_bubble_color_dark: stringConfig(
            activity.config.bubbleColorDark,
            '#0f172a',
        ),
        tool_grant_bubble_color_light: stringConfig(
            activity.config.bubbleColorLight,
            '#ffffff',
        ),
        tool_grant_bubble_opacity_dark: stringConfig(
            activity.config.bubbleOpacityDark,
            '92',
        ),
        tool_grant_bubble_opacity_light: stringConfig(
            activity.config.bubbleOpacityLight,
            '94',
        ),
        tool_grant_fade_duration_seconds: stringConfig(
            activity.config.fadeDurationSeconds,
            '0.4',
        ),
        tool_grant_slide_direction: stringConfig(
            activity.config.slideDirection,
            'left',
        ),
        tool_grant_slide_duration_seconds: stringConfig(
            activity.config.slideDurationSeconds,
            '0.6',
        ),
        tool_grant_text: stringConfig(activity.config.text),
        tool_grant_tool_id: stringConfig(activity.config.toolId),
        tool_grant_tool_x: stringConfig(activity.config.toolX, '50'),
        tool_grant_tool_y: stringConfig(activity.config.toolY, '50'),
        tool_grant_typing_speed: stringConfig(
            activity.config.typingSpeed,
            '24',
        ),
        type: activity.type || fallbackType,
    };
}

function stringConfig(value: unknown, fallback = ''): string {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value.toString();
    }

    if (typeof value === 'string') {
        return value;
    }

    return fallback;
}

function booleanConfig(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();

        if (['false', '0', 'no', 'off'].includes(normalized)) {
            return false;
        }

        if (['true', '1', 'yes', 'on'].includes(normalized)) {
            return true;
        }
    }

    return fallback;
}

function arrayConfig(value: unknown): Array<number | string> {
    return Array.isArray(value)
        ? value.filter(
              (item): item is number | string =>
                  typeof item === 'number' || typeof item === 'string',
          )
        : [];
}
