import type { components } from './api/schema';
import type { ActivityForm } from './lifted-world-builder-edit-node-activity-types';

export type SourceCommonActivityRequest = {
    introduction: string | null;
    slug: string | null;
    title: string;
};

export function sourceCommonActivityRequest(
    form: ActivityForm,
): SourceCommonActivityRequest {
    return {
        introduction: optionalString(form.introduction),
        slug: optionalString(form.slug),
        title: form.title,
    };
}

export function optionalString(value: string): string | null {
    const normalized = value.trim();

    return normalized === '' ? null : normalized;
}

export function sourceOpenPracticeRequest(
    form: ActivityForm,
): components['schemas']['CreateAdminOpenPracticeActivityRequest'] {
    return { ...sourceCommonActivityRequest(form), next_step: optionalString(form.open_practice_next_step) };
}

export function sourceReflectionRequest(
    form: ActivityForm,
): components['schemas']['CreateAdminReflectionActivityRequest'] {
    return {
        ...sourceCommonActivityRequest(form),
        note: optionalString(form.reflection_note),
        prompt: optionalString(form.reflection_prompt),
        subtopic: optionalString(form.reflection_subtopic),
        topic: optionalString(form.reflection_topic),
    };
}

export function sourceQuestionRequest(
    form: ActivityForm,
): components['schemas']['CreateAdminQuestionActivityRequest'] {
    return {
        ...sourceCommonActivityRequest(form),
        allow_multiple: form.question_allow_multiple,
        explanation: form.question_explanation,
        feedback_correct: form.question_feedback_correct,
        feedback_incorrect: form.question_feedback_incorrect,
        options: form.question_options.map((option) => ({
            body: option.body,
            feedback: option.feedback,
            is_correct: option.is_correct,
            key: null,
            label: option.label,
            outcome_key: option.outcome_key,
            weights: option.weights,
        })),
        prompt: form.question_prompt,
    };
}

export function sourceMessageRequest(
    form: ActivityForm,
): components['schemas']['CreateAdminMessageActivityRequest'] {
    return {
        ...sourceCommonActivityRequest(form),
        accent_color_dark: form.message_accent_color_dark,
        accent_color_light: form.message_accent_color_light,
        activity_type: form.type as 'message_prompt' | 'message_wall',
        allow_responses: form.type === 'message_wall' && form.message_allow_responses,
        audience: form.type === 'message_wall' ? 'peers' : form.message_audience as 'peers' | 'support',
        card_border_color_dark: form.message_card_border_color_dark,
        card_border_color_light: form.message_card_border_color_light,
        card_color_dark: form.message_card_color_dark,
        card_color_light: form.message_card_color_light,
        input_label: form.message_input_label,
        prompt: form.message_prompt_text,
        response_prompt: form.message_response_prompt,
        surface_color_dark: form.message_surface_color_dark,
        surface_color_light: form.message_surface_color_light,
        text_color_dark: form.message_text_color_dark,
        text_color_light: form.message_text_color_light,
        topic_id: optionalString(form.message_topic_id),
        topic_title: form.message_topic_title,
    };
}

export function sourceSharedTaskRequest(
    form: ActivityForm,
): components['schemas']['CreateAdminSharedTaskActivityRequest'] {
    return {
        ...sourceCommonActivityRequest(form),
        cycle_mode: form.shared_task_cycle_mode as 'none' | 'question_response_question',
        input_label: form.shared_task_input_label,
        instructions: form.shared_task_instructions,
        minimum_length: Number(form.shared_task_minimum_length),
        peer_review_enabled: form.shared_task_peer_review_enabled,
        peer_review_prompt: form.shared_task_peer_review_prompt,
        project_deliverable: form.shared_task_project_deliverable,
        project_goal: form.shared_task_project_goal,
        project_steps: form.shared_task_project_steps.split(/\r?\n/).map((step) => step.trim()).filter(Boolean),
        prompt: form.shared_task_prompt,
        repeat_policy: form.shared_task_repeat_policy as 'once_per_user' | 'unlimited',
        show_contributions: form.shared_task_show_contributions,
        task_kind: form.shared_task_kind as 'text' | 'question' | 'reflection',
        threshold: Number(form.shared_task_threshold),
        validation_mode: form.shared_task_validation_mode as 'minimum_length' | 'none',
    };
}

export function sourceItemGrantRequest(
    form: ActivityForm,
): components['schemas']['CreateAdminItemGrantActivityRequest'] {
    return {
        ...sourceCommonActivityRequest(form),
        background_dark: optionalString(form.item_grant_background_dark),
        background_light: optionalString(form.item_grant_background_light),
        background_mirrored: form.item_grant_background_mirrored,
        items: form.item_grant_items
            .filter((item) => item.itemId !== '')
            .map((item) => ({ item_id: item.itemId, quantity: Number(item.quantity) })),
        probability_percent: Number(form.item_grant_probability_percent),
    };
}

export function sourceMarkdownRequest(
    form: ActivityForm,
): components['schemas']['CreateAdminMarkdownActivityRequest'] {
    return {
        ...sourceCommonActivityRequest(form),
        markdown_graph_layout: form.markdown_graph_layout,
        markdown_pages: form.markdown_pages.map((page) => ({
            body: page.body,
            id: page.id,
            position: page.position,
            title: page.title,
            visual: {
                border_color_dark: page.visual.borderColorDark,
                border_color_light: page.visual.borderColorLight,
                heading_color_dark: page.visual.headingColorDark,
                heading_color_light: page.visual.headingColorLight,
                page_color_dark: page.visual.pageColorDark,
                page_color_light: page.visual.pageColorLight,
                text_color_dark: page.visual.textColorDark,
                text_color_light: page.visual.textColorLight,
            },
        })),
        markdown_transitions: form.markdown_transitions,
    };
}

export function sourcePortalRequest(
    form: ActivityForm,
): components['schemas']['CreateAdminPortalActivityRequest'] {
    return {
        ...sourceCommonActivityRequest(form),
        portal_assets: form.portal_assets.map((asset) => ({
            id: asset.id,
            image_dark: asset.imageDark,
            image_light: asset.imageLight,
            label: asset.label,
            layer: asset.layer as 'behind-background' | 'above-background' | 'above-foreground' | 'front',
            mirrored: asset.mirrored,
            opacity: Number(asset.opacity),
            width: Number(asset.width),
            x: Number(asset.x),
            y: Number(asset.y),
        })),
        portal_background_dark: form.portal_background_dark,
        portal_background_light: form.portal_background_light,
        portal_background_mirrored: form.portal_background_mirrored,
        portal_bubble_border_color_dark: form.portal_bubble_border_color_dark,
        portal_bubble_border_color_light: form.portal_bubble_border_color_light,
        portal_bubble_color_dark: form.portal_bubble_color_dark,
        portal_bubble_color_light: form.portal_bubble_color_light,
        portal_bubble_text: form.portal_bubble_text,
        portal_bubble_text_color_dark: form.portal_bubble_text_color_dark,
        portal_bubble_text_color_light: form.portal_bubble_text_color_light,
        portal_bubble_typing_speed: Number(form.portal_bubble_typing_speed),
        portal_duration_seconds: Number(form.portal_duration_seconds),
        portal_foreground_dark: form.portal_foreground_dark,
        portal_foreground_light: form.portal_foreground_light,
        portal_foreground_mirrored: form.portal_foreground_mirrored,
        portal_foreground_width: Number(form.portal_foreground_width),
        portal_foreground_x: Number(form.portal_foreground_x),
        portal_foreground_y: Number(form.portal_foreground_y),
        portal_mode: form.portal_mode,
        portal_show_on_arrival: form.portal_show_on_arrival,
        portal_swirl_enabled: form.portal_swirl_enabled,
        portal_wait_for_enter: form.portal_wait_for_enter,
        target_portal_activity_id: form.portal_mode === 'output'
            ? optionalString(form.target_portal_activity_id)
            : null,
    };
}

export function sourceToolGrantRequest(
    form: ActivityForm,
): components['schemas']['CreateAdminToolGrantActivityRequest'] {
    return {
        ...sourceCommonActivityRequest(form),
        background_dark: optionalString(form.tool_grant_background_dark),
        background_light: optionalString(form.tool_grant_background_light),
        background_mirrored: form.tool_grant_background_mirrored,
        bubble_border_color_dark: optionalString(form.tool_grant_bubble_border_color_dark),
        bubble_border_color_light: optionalString(form.tool_grant_bubble_border_color_light),
        bubble_color_dark: optionalString(form.tool_grant_bubble_color_dark),
        bubble_color_light: optionalString(form.tool_grant_bubble_color_light),
        bubble_opacity_dark: Number(form.tool_grant_bubble_opacity_dark),
        bubble_opacity_light: Number(form.tool_grant_bubble_opacity_light),
        fade_duration_seconds: Number(form.tool_grant_fade_duration_seconds),
        slide_direction: optionalString(form.tool_grant_slide_direction) as 'left' | 'right' | 'top' | 'bottom' | 'none' | null,
        slide_duration_seconds: Number(form.tool_grant_slide_duration_seconds),
        text: optionalString(form.tool_grant_text),
        tool_id: optionalString(form.tool_grant_tool_id),
        tool_mirrored: form.tool_grant_tool_mirrored,
        tool_x: Number(form.tool_grant_tool_x),
        tool_y: Number(form.tool_grant_tool_y),
        typing_speed: Number(form.tool_grant_typing_speed),
    };
}

export function sourceItemObstacleRequest(
    form: ActivityForm,
): components['schemas']['CreateAdminItemObstacleActivityRequest'] {
    return {
        ...sourceCommonActivityRequest(form),
        background_dark: optionalString(form.item_obstacle_background_dark),
        background_light: optionalString(form.item_obstacle_background_light),
        background_mirrored: form.item_obstacle_background_mirrored,
        consume_on_each_entry: form.item_obstacle_consume_on_each_entry,
        lock_minutes: Number(form.item_obstacle_lock_minutes),
        met_background_dark: optionalString(form.item_obstacle_met_background_dark),
        met_background_light: optionalString(form.item_obstacle_met_background_light),
        met_background_mirrored: form.item_obstacle_met_background_mirrored,
        overlay_dark: optionalString(form.item_obstacle_overlay_dark),
        overlay_light: optionalString(form.item_obstacle_overlay_light),
        overlay_mirrored: form.item_obstacle_overlay_mirrored,
        overlay_width: Number(form.item_obstacle_overlay_width),
        overlay_x: Number(form.item_obstacle_overlay_x),
        overlay_y: Number(form.item_obstacle_overlay_y),
        slots: form.item_obstacle_slots.map((slot) => ({
            item_id: optionalString(slot.itemId),
            width: Number(slot.width),
            x: Number(slot.x),
            y: Number(slot.y),
        })),
        sound_met_enabled: form.item_obstacle_sound_met_enabled,
        sound_met_id: optionalString(form.item_obstacle_sound_met_id),
        sound_not_met_enabled: form.item_obstacle_sound_not_met_enabled,
        sound_not_met_id: optionalString(form.item_obstacle_sound_not_met_id),
        sound_transition_enabled: form.item_obstacle_sound_transition_enabled,
        sound_transition_id: optionalString(form.item_obstacle_sound_transition_id),
    };
}

export function sourceObstacleRequest(
    form: ActivityForm,
): components['schemas']['CreateAdminObstacleActivityRequest'] {
    return {
        ...sourceCommonActivityRequest(form),
        allowed_tool_ids: form.obstacle_allowed_tool_ids.split(',').map((id) => id.trim()).filter(Boolean),
        background_dark: optionalString(form.obstacle_background_dark),
        background_light: optionalString(form.obstacle_background_light),
        background_mirrored: form.obstacle_background_mirrored,
        bubble_border_color_dark: optionalString(form.obstacle_bubble_border_color_dark),
        bubble_border_color_light: optionalString(form.obstacle_bubble_border_color_light),
        bubble_color_dark: optionalString(form.obstacle_bubble_color_dark),
        bubble_color_light: optionalString(form.obstacle_bubble_color_light),
        bubble_opacity_dark: Number(form.obstacle_bubble_opacity_dark),
        bubble_opacity_light: Number(form.obstacle_bubble_opacity_light),
        obstacle_image_dark: optionalString(form.obstacle_image_dark),
        obstacle_image_light: optionalString(form.obstacle_image_light),
        obstacle_image_mirrored: form.obstacle_image_mirrored,
        obstacle_width: Number(form.obstacle_width),
        obstacle_x: Number(form.obstacle_x),
        obstacle_y: Number(form.obstacle_y),
        persist_after_solved: form.obstacle_persist_after_solved,
        prompt_text: optionalString(form.obstacle_prompt_text),
        revisit_background_dark: optionalString(form.obstacle_revisit_background_dark),
        revisit_background_light: optionalString(form.obstacle_revisit_background_light),
        revisit_background_mirrored: form.obstacle_revisit_background_mirrored,
        revisit_image_dark: optionalString(form.obstacle_revisit_image_dark),
        revisit_image_light: optionalString(form.obstacle_revisit_image_light),
        revisit_image_mirrored: form.obstacle_revisit_image_mirrored,
        revisit_text: optionalString(form.obstacle_revisit_text),
        success_animation: optionalString(form.obstacle_success_animation) as 'none' | 'zoom' | 'shake' | 'rotate' | null,
        success_text: optionalString(form.obstacle_success_text),
        typing_speed: Number(form.obstacle_typing_speed),
    };
}
