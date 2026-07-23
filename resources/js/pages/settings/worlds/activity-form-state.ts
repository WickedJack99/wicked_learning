import type {
    ActivityForm,
    ActivitySummary,
    CreateActivityForm,
    MarkdownPageForm,
    MarkdownTransitionForm,
    PortalAssetForm,
} from './edit-node-activity-types';
export function emptyCreateForm(type: string): CreateActivityForm {
    return {
        competence_topics: [{ topic: '', weight: '1' }],
        introduction: '',
        item_grant_background_dark: '',
        item_grant_background_light: '',
        item_grant_background_mirrored: false,
        item_grant_items: [{ itemId: '', quantity: '1' }],
        item_grant_probability_percent: '100',
        item_obstacle_background_dark: '',
        item_obstacle_background_light: '',
        item_obstacle_background_mirrored: false,
        item_obstacle_lock_minutes: '0',
        item_obstacle_met_background_dark: '',
        item_obstacle_met_background_light: '',
        item_obstacle_met_background_mirrored: false,
        item_obstacle_overlay_dark: '',
        item_obstacle_overlay_light: '',
        item_obstacle_overlay_mirrored: false,
        item_obstacle_overlay_width: '30',
        item_obstacle_overlay_x: '50',
        item_obstacle_overlay_y: '50',
        item_obstacle_slots: [{ itemId: '', x: '50', y: '50', width: '10' }],
        item_obstacle_consume_on_each_entry: false,
        item_obstacle_sound_met_enabled: false,
        item_obstacle_sound_met_id: '',
        item_obstacle_sound_not_met_enabled: false,
        item_obstacle_sound_not_met_id: '',
        item_obstacle_sound_transition_enabled: false,
        item_obstacle_sound_transition_id: '',
        markdown_pages: defaultMarkdownPages(),
        markdown_graph_layout: {},
        markdown_transitions: [
            {
                from: 'start',
                id: 'start-page-1',
                to: 'page-1',
            },
            {
                from: 'page-1',
                id: 'page-1-end',
                to: 'end',
            },
        ],
        obstacle_allowed_tool_ids: '',
        obstacle_background_dark: '',
        obstacle_background_light: '',
        obstacle_background_mirrored: false,
        obstacle_bubble_border_color_dark: '#2dd4bf',
        obstacle_bubble_border_color_light: '#0891b2',
        obstacle_bubble_color_dark: '#0f172a',
        obstacle_bubble_color_light: '#ffffff',
        obstacle_bubble_opacity_dark: '92',
        obstacle_bubble_opacity_light: '94',
        obstacle_image_dark: '',
        obstacle_image_light: '',
        obstacle_image_mirrored: false,
        obstacle_persist_after_solved: true,
        obstacle_prompt_text: '',
        obstacle_width: '28',
        obstacle_x: '50',
        obstacle_y: '50',
        obstacle_revisit_background_dark: '',
        obstacle_revisit_background_light: '',
        obstacle_revisit_background_mirrored: false,
        obstacle_revisit_image_dark: '',
        obstacle_revisit_image_light: '',
        obstacle_revisit_image_mirrored: false,
        obstacle_revisit_text: '',
        obstacle_success_animation: 'zoom',
        obstacle_success_text: '',
        obstacle_typing_speed: '24',
        portal_background_dark: '',
        portal_background_light: '',
        portal_background_mirrored: false,
        portal_assets: [],
        portal_duration_seconds: '1.5',
        portal_foreground_dark: '',
        portal_foreground_light: '',
        portal_foreground_mirrored: false,
        portal_foreground_width: '28',
        portal_foreground_x: '50',
        portal_foreground_y: '50',
        portal_mode: 'output',
        portal_show_on_arrival: true,
        portal_swirl_enabled: true,
        portal_bubble_text: '',
        portal_bubble_typing_speed: '24',
        portal_bubble_color_dark: '#0f172a',
        portal_bubble_color_light: '#ffffff',
        portal_bubble_border_color_dark: '#2dd4bf',
        portal_bubble_border_color_light: '#0891b2',
        portal_bubble_text_color_dark: '#f8fafc',
        portal_bubble_text_color_light: '#0f172a',
        portal_wait_for_enter: false,
        reflection_note: '',
        reflection_prompt: 'What feels clearer now?',
        reflection_subtopic: '',
        reflection_topic: '',
        shared_task_cycle_mode: 'none',
        shared_task_input_label: 'Your contribution',
        shared_task_instructions: '',
        shared_task_kind: 'text',
        shared_task_minimum_length: '20',
        shared_task_prompt: 'Add a useful contribution.',
        shared_task_repeat_policy: 'once_per_user',
        shared_task_threshold: '3',
        shared_task_validation_mode: 'minimum_length',
        slug: '',
        target_portal_activity_id: '',
        title: '',
        tool_grant_background_dark: '',
        tool_grant_background_light: '',
        tool_grant_background_mirrored: false,
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
        tool_grant_tool_mirrored: false,
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
        competence_topics: competenceTopics(activity.config.competenceTopics),
        introduction: activity.introduction ?? '',
        item_grant_background_dark: stringConfig(
            activity.config.backgroundDark,
        ),
        item_grant_background_light: stringConfig(
            activity.config.backgroundLight,
        ),
        item_grant_background_mirrored: booleanConfig(
            activity.config.backgroundMirrored,
            false,
        ),
        item_grant_items: itemGrantItems(activity.config.items),
        item_grant_probability_percent: stringConfig(
            activity.config.probabilityPercent,
            '100',
        ),
        item_obstacle_background_dark: stringConfig(
            activity.config.backgroundDark,
        ),
        item_obstacle_background_light: stringConfig(
            activity.config.backgroundLight,
        ),
        item_obstacle_background_mirrored: booleanConfig(
            activity.config.backgroundMirrored,
            false,
        ),
        item_obstacle_lock_minutes: stringConfig(
            activity.config.lockMinutes,
            '0',
        ),
        item_obstacle_met_background_dark: stringConfig(
            activity.config.metBackgroundDark,
        ),
        item_obstacle_met_background_light: stringConfig(
            activity.config.metBackgroundLight,
        ),
        item_obstacle_met_background_mirrored: booleanConfig(
            activity.config.metBackgroundMirrored,
            false,
        ),
        item_obstacle_overlay_dark: stringConfig(activity.config.overlayDark),
        item_obstacle_overlay_light: stringConfig(activity.config.overlayLight),
        item_obstacle_overlay_mirrored: booleanConfig(
            activity.config.overlayMirrored,
            false,
        ),
        item_obstacle_overlay_width: stringConfig(
            activity.config.overlayWidth,
            '30',
        ),
        item_obstacle_overlay_x: stringConfig(activity.config.overlayX, '50'),
        item_obstacle_overlay_y: stringConfig(activity.config.overlayY, '50'),
        item_obstacle_slots: itemObstacleSlots(activity.config.slots),
        item_obstacle_consume_on_each_entry: booleanConfig(
            activity.config.consumeOnEachEntry,
            false,
        ),
        item_obstacle_sound_met_enabled: soundEnabled(
            activity.config.sounds,
            'met',
        ),
        item_obstacle_sound_met_id: soundId(activity.config.sounds, 'met'),
        item_obstacle_sound_not_met_enabled: soundEnabled(
            activity.config.sounds,
            'notMet',
        ),
        item_obstacle_sound_not_met_id: soundId(
            activity.config.sounds,
            'notMet',
        ),
        item_obstacle_sound_transition_enabled: soundEnabled(
            activity.config.sounds,
            'transition',
        ),
        item_obstacle_sound_transition_id: soundId(
            activity.config.sounds,
            'transition',
        ),
        markdown_pages: markdownPages(activity.config.markdownPages),
        markdown_graph_layout: graphLayout(activity.config.markdownGraphLayout),
        markdown_transitions: markdownTransitions(
            activity.config.markdownTransitions,
        ),
        obstacle_allowed_tool_ids: arrayConfig(
            activity.config.allowedToolIds,
        ).join(', '),
        obstacle_background_dark: stringConfig(activity.config.backgroundDark),
        obstacle_background_light: stringConfig(
            activity.config.backgroundLight,
        ),
        obstacle_background_mirrored: booleanConfig(
            activity.config.backgroundMirrored,
            false,
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
        obstacle_image_mirrored: booleanConfig(
            activity.config.obstacleImageMirrored,
            false,
        ),
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
        obstacle_revisit_background_mirrored: booleanConfig(
            activity.config.revisitBackgroundMirrored,
            false,
        ),
        obstacle_revisit_image_dark: stringConfig(
            activity.config.revisitImageDark,
        ),
        obstacle_revisit_image_light: stringConfig(
            activity.config.revisitImageLight,
        ),
        obstacle_revisit_image_mirrored: booleanConfig(
            activity.config.revisitImageMirrored,
            false,
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
        portal_background_mirrored: booleanConfig(
            activity.config.portalBackgroundMirrored,
            false,
        ),
        portal_assets: portalAssets(activity.config.portalAssets),
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
        portal_foreground_mirrored: booleanConfig(
            activity.config.portalForegroundMirrored,
            false,
        ),
        portal_foreground_width: stringConfig(
            activity.config.portalForegroundWidth,
            '28',
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
        portal_show_on_arrival: booleanConfig(
            activity.config.portalShowOnArrival,
            true,
        ),
        portal_swirl_enabled: activity.config.portalSwirlEnabled !== false,
        portal_bubble_text: stringConfig(activity.config.portalBubbleText),
        portal_bubble_typing_speed: stringConfig(
            activity.config.portalBubbleTypingSpeed,
            '24',
        ),
        portal_bubble_color_dark: stringConfig(
            activity.config.portalBubbleColorDark,
            '#0f172a',
        ),
        portal_bubble_color_light: stringConfig(
            activity.config.portalBubbleColorLight,
            '#ffffff',
        ),
        portal_bubble_border_color_dark: stringConfig(
            activity.config.portalBubbleBorderColorDark,
            '#2dd4bf',
        ),
        portal_bubble_border_color_light: stringConfig(
            activity.config.portalBubbleBorderColorLight,
            '#0891b2',
        ),
        portal_bubble_text_color_dark: stringConfig(
            activity.config.portalBubbleTextColorDark,
            '#f8fafc',
        ),
        portal_bubble_text_color_light: stringConfig(
            activity.config.portalBubbleTextColorLight,
            '#0f172a',
        ),
        portal_wait_for_enter: booleanConfig(
            activity.config.portalWaitForEnter,
            false,
        ),
        reflection_note: stringConfig(activity.config.note),
        reflection_prompt: stringConfig(
            activity.config.prompt,
            'What feels clearer now?',
        ),
        reflection_subtopic: stringConfig(activity.config.subtopic),
        reflection_topic: stringConfig(activity.config.topic),
        shared_task_cycle_mode: stringConfig(activity.config.cycleMode, 'none'),
        shared_task_input_label: stringConfig(
            activity.config.inputLabel,
            'Your contribution',
        ),
        shared_task_instructions: stringConfig(activity.config.instructions),
        shared_task_kind: stringConfig(activity.config.taskKind, 'text'),
        shared_task_minimum_length: stringConfig(
            activity.config.minimumLength,
            '20',
        ),
        shared_task_prompt: stringConfig(
            activity.config.prompt,
            'Add a useful contribution.',
        ),
        shared_task_repeat_policy: stringConfig(
            activity.config.repeatPolicy,
            'once_per_user',
        ),
        shared_task_threshold: stringConfig(activity.config.threshold, '3'),
        shared_task_validation_mode: stringConfig(
            activity.config.validationMode,
            'minimum_length',
        ),
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
        tool_grant_background_mirrored: booleanConfig(
            activity.config.backgroundMirrored,
            false,
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
        tool_grant_tool_mirrored: booleanConfig(
            activity.config.toolMirrored,
            false,
        ),
        tool_grant_tool_x: stringConfig(activity.config.toolX, '50'),
        tool_grant_tool_y: stringConfig(activity.config.toolY, '50'),
        tool_grant_typing_speed: stringConfig(
            activity.config.typingSpeed,
            '24',
        ),
        type: activity.type || fallbackType,
    };
}

function competenceTopics(value: unknown): ActivityForm['competence_topics'] {
    if (!Array.isArray(value)) {
        return [{ topic: '', weight: '1' }];
    }

    const topics = value
        .filter(isRecord)
        .map((topic) => ({
            topic: stringConfig(topic.topic),
            weight: stringConfig(topic.weight, '1'),
        }))
        .filter((topic) => topic.topic.trim().length > 0);

    return topics.length > 0 ? topics : [{ topic: '', weight: '1' }];
}

function graphLayout(value: unknown): ActivityForm['markdown_graph_layout'] {
    if (!isRecord(value)) {
        return {};
    }

    const layout: ActivityForm['markdown_graph_layout'] = {};

    for (const key of ['start', 'end'] as const) {
        const position = isRecord(value[key]) ? value[key] : null;

        if (!position) {
            continue;
        }

        layout[key] = {
            x: numericConfig(position.x, key === 'start' ? -160 : 520),
            y: numericConfig(position.y, 80),
        };
    }

    return layout;
}

function defaultMarkdownPages(): MarkdownPageForm[] {
    return [
        {
            body: '# First page\n\nWrite markdown content here. Use `![Alt text](/path/to/image.svg)` to insert images.',
            id: 'page-1',
            position: {
                x: 140,
                y: 80,
            },
            title: 'First page',
            visual: {
                borderColorDark: '#2dd4bf',
                borderColorLight: '#0891b2',
                headingColorDark: '#67e8f9',
                headingColorLight: '#0e7490',
                pageColorDark: '#0f172a',
                pageColorLight: '#ffffff',
                textColorDark: '#f8fafc',
                textColorLight: '#0f172a',
            },
        },
    ];
}

function markdownPages(value: unknown): MarkdownPageForm[] {
    if (!Array.isArray(value)) {
        return defaultMarkdownPages();
    }

    const pages = value
        .filter(isRecord)
        .map((page, index): MarkdownPageForm => {
            const position = isRecord(page.position) ? page.position : {};
            const visual = isRecord(page.visual) ? page.visual : {};

            return {
                body: stringConfig(page.body),
                id: stringConfig(page.id, `page-${index + 1}`),
                position: {
                    x: numericConfig(position.x, 140 + index * 260),
                    y: numericConfig(position.y, 80),
                },
                title: stringConfig(page.title, `Page ${index + 1}`),
                visual: {
                    borderColorDark: stringConfig(
                        visual.borderColorDark,
                        '#2dd4bf',
                    ),
                    borderColorLight: stringConfig(
                        visual.borderColorLight,
                        '#0891b2',
                    ),
                    headingColorDark: stringConfig(
                        visual.headingColorDark,
                        '#67e8f9',
                    ),
                    headingColorLight: stringConfig(
                        visual.headingColorLight,
                        '#0e7490',
                    ),
                    pageColorDark: stringConfig(
                        visual.pageColorDark,
                        '#0f172a',
                    ),
                    pageColorLight: stringConfig(
                        visual.pageColorLight,
                        '#ffffff',
                    ),
                    textColorDark: stringConfig(
                        visual.textColorDark,
                        '#f8fafc',
                    ),
                    textColorLight: stringConfig(
                        visual.textColorLight,
                        '#0f172a',
                    ),
                },
            };
        });

    return pages.length > 0 ? pages : defaultMarkdownPages();
}

function markdownTransitions(value: unknown): MarkdownTransitionForm[] {
    if (!Array.isArray(value)) {
        return [
            {
                from: 'start',
                id: 'start-page-1',
                to: 'page-1',
            },
            {
                from: 'page-1',
                id: 'page-1-end',
                to: 'end',
            },
        ];
    }

    return value
        .filter(isRecord)
        .map(
            (transition, index): MarkdownTransitionForm => ({
                from: stringConfig(transition.from, 'start'),
                id: stringConfig(transition.id, `markdown-edge-${index + 1}`),
                to: stringConfig(transition.to, 'end'),
            }),
        )
        .filter((transition) => transition.from && transition.to);
}

function itemGrantItems(value: unknown): ActivityForm['item_grant_items'] {
    if (!Array.isArray(value)) {
        return [{ itemId: '', quantity: '1' }];
    }

    const items = value
        .filter(isRecord)
        .map((item) => ({
            itemId: stringConfig(item.itemId),
            quantity: stringConfig(item.quantity, '1'),
        }))
        .filter((item) => item.itemId);

    return items.length > 0 ? items : [{ itemId: '', quantity: '1' }];
}

function portalAssets(value: unknown): PortalAssetForm[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter(isRecord).map((asset, index) => ({
        id: stringConfig(asset.id, `portal-asset-${index + 1}`),
        imageDark: stringConfig(asset.imageDark),
        imageLight: stringConfig(asset.imageLight),
        label: stringConfig(asset.label, `Asset ${index + 1}`),
        layer: stringConfig(asset.layer, 'above-background'),
        mirrored: booleanConfig(asset.mirrored, false),
        opacity: stringConfig(asset.opacity, '100'),
        width: stringConfig(asset.width, '28'),
        x: stringConfig(asset.x, '50'),
        y: stringConfig(asset.y, '50'),
    }));
}

function itemObstacleSlots(
    value: unknown,
): ActivityForm['item_obstacle_slots'] {
    if (!Array.isArray(value)) {
        return [{ itemId: '', x: '50', y: '50', width: '10' }];
    }

    const slots = value.filter(isRecord).map((slot) => ({
        itemId: stringConfig(slot.itemId),
        width: stringConfig(slot.width, '10'),
        x: stringConfig(slot.x, '50'),
        y: stringConfig(slot.y, '50'),
    }));

    return slots.length > 0
        ? slots
        : [{ itemId: '', x: '50', y: '50', width: '10' }];
}

function soundEnabled(value: unknown, key: string): boolean {
    const sounds = isRecord(value) ? value : {};
    const sound = isRecord(sounds[key]) ? sounds[key] : {};

    return booleanConfig(sound.enabled, false);
}

function soundId(value: unknown, key: string): string {
    const sounds = isRecord(value) ? value : {};
    const sound = isRecord(sounds[key]) ? sounds[key] : {};

    return stringConfig(sound.soundId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numericConfig(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
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
