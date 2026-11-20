import type { components } from './api/schema';
import { JsonRequestError } from './json-request-error';

type Schema = components['schemas'];
type Playback = Schema['LearnerPlaybackDocument'];
type Activity = Schema['LearnerPlaybackGraphActivity'];

/**
 * Data seam for the whole copied NodePlay page. Rust UUIDs and authored option
 * keys stay opaque: source numeric declarations never justify numeric aliases.
 * This does not activate the route or acknowledge any player command.
 */
export function toPlaybackPageProps(document: Playback) {
    const { node, graph, private_state: saved } = document;
    const byId = new Map(graph.activities.map((activity) => [activity.id, activity]));
    if (graph.node_id !== node.id || document.context.node_id !== node.id ||
        document.context.map_id !== node.map_id || !byId.has(document.activity.id) ||
        (document.start_id !== null && !graph.starts.some((start) => start.id === document.start_id))) {
        return unavailable();
    }
    if ((graph.start_activity_id && !byId.has(graph.start_activity_id)) ||
        graph.starts.some((start) => !byId.has(start.activity_id)) ||
        graph.activities.some((activity) => activity.transitions.some((edge) =>
            edge.to_activity_id !== null && !byId.has(edge.to_activity_id)))) return unavailable();

    const itemStates = new Map(saved.item_obstacles.map((entry) => [entry.activity_id, entry.state]));
    const resolutions = new Map(saved.obstacle_resolutions.map((entry) => [entry.activity_id, entry.resolved_at]));
    const activities = Object.fromEntries(saved.activities.map((progress) => [progress.activity_id, {
        status: progress.status,
        completedAt: progress.completed_at,
        metadata: toActivityMetadata(
            required(byId.get(progress.activity_id)),
            itemStates.get(progress.activity_id) ?? null,
            resolutions.get(progress.activity_id) ?? null,
        ),
    }]));
    const answers = Object.fromEntries(saved.answers.map((answer) => {
        const question = required(required(byId.get(answer.activity_id)).presentation.question);
        if (answer.selected_option_keys.some((key) => !question.options.some((option) => option.key === key))) return unavailable();
        if (answer.next_activity_id !== null && !byId.has(answer.next_activity_id)) return unavailable();
        return [answer.activity_id, {
            optionId: answer.selected_option_keys[0] ?? null,
            optionIds: [...answer.selected_option_keys],
            isCorrect: answer.is_correct,
            attemptNumber: answer.attempt_number,
            confidence: answer.confidence,
            calibration: answer.calibration,
            feedback: answer.feedback,
            explanation: answer.explanation,
            nextActivityId: answer.next_activity_id,
            nextTransitionLabel: answer.next_transition_label,
            earlierAttempts: answer.earlier_attempts.map((attempt) => ({
                answeredAt: attempt.answered_at, calibration: attempt.calibration,
                confidence: attempt.confidence, isCorrect: attempt.is_correct,
                optionLabel: attempt.option_label, optionLabels: [...attempt.option_labels],
            })),
        }];
    }));
    const playState: Record<string, {
        npcDialogue?: { currentNodeId: string; history: string[] };
        sharedTask?: { completedStepIndexes: number[] };
    }> = {};
    for (const dialogue of saved.npc_dialogues) {
        const activity = required(byId.get(dialogue.activity_id));
        const nodes = new Set(activity.presentation.npc_dialogue_nodes.map((entry) => entry.id));
        if (!nodes.has(dialogue.current_node_id) || dialogue.history.some((id) => !nodes.has(id))) return unavailable();
        playState[dialogue.activity_id] = {
            npcDialogue: { currentNodeId: dialogue.current_node_id, history: [...dialogue.history] },
        };
    }
    for (const checklist of saved.shared_task_checklists) {
        required(byId.get(checklist.activity_id));
        playState[checklist.activity_id] = {
            ...playState[checklist.activity_id],
            sharedTask: { completedStepIndexes: [...checklist.completed_step_indexes] },
        };
    }
    for (const id of saved.recall_activity_ids) required(required(byId.get(id)).presentation.question);

    return {
        isBookmarked: node.is_bookmarked,
        playActivityId: document.activity.id,
        playRouteId: document.start_id,
        playRunId: document.play_run_id,
        recallQuestionId: document.run_kind === 'recall' ? document.activity.id : null,
        revisitActivityId: document.run_kind === 'revisit' ? document.activity.id : null,
        playState,
        progress: { activities, answers, recallQuestionIds: [...saved.recall_activity_ids] },
        node: {
            id: node.id, mapId: node.map_id, mapSlug: node.map_slug, mapTitle: node.map_title,
            slug: node.slug, title: node.title, description: node.description,
            position: { q: node.q, r: node.r }, state: node.state,
            visualConfig: node.visual_config,
            topic: node.topic ? {
                slug: node.topic.slug, title: node.topic.title,
                href: `/topics/${encodeURIComponent(node.topic.slug)}`,
                competenceHref: `/competence?topic=${encodeURIComponent(node.topic.slug)}`,
            } : null,
            outgoingPortalLinks: node.outgoing_portal_links.map((link) => ({
                id: link.id, description: link.description, label: link.label,
                sourceActivityId: link.source_activity_id, targetActivityId: link.target_activity_id,
                targetMapId: link.target_map_id, targetMapSlug: link.target_map_slug,
                targetMapTitle: link.target_map_title, targetNodeId: link.target_node_id,
                targetNodeSlug: link.target_node_slug, targetNodeState: link.target_node_state,
                targetNodeTitle: link.target_node_title,
            })),
            startActivityId: graph.start_activity_id,
            startRoutes: graph.starts.map((start) => ({
                id: start.id, activityId: start.activity_id, label: start.label, description: start.description,
                imageDark: start.image_dark, imageLight: start.image_light,
                buttonColorDark: start.button_color_dark, buttonColorLight: start.button_color_light,
                buttonBorderColorDark: start.button_border_color_dark, buttonBorderColorLight: start.button_border_color_light,
                sortOrder: start.sort_order,
                progress: start.progress ? {
                    status: start.progress.status, completionCount: start.progress.completion_count,
                    currentActivityId: start.progress.current_activity_id, playRunId: start.progress.play_run_id,
                    lastCompletedAt: start.progress.last_completed_at, lastEnteredAt: start.progress.last_entered_at,
                } : null,
            })),
            activities: graph.activities.map(toSourcePlaybackActivity),
        },
    };
}

export function toSourcePlaybackActivity(activity: Activity) {
    const presentation = activity.presentation;
    const config = sourceConfig(activity);
    return {
        id: activity.id, slug: activity.slug, type: activity.activity_type, title: activity.title,
        introduction: activity.introduction, timeGuideMinutes: activity.time_guide_minutes, config,
        evidenceContext: { objective: activity.check_in.objective, concepts: [...activity.check_in.concepts] },
        completionChoicePrompt: presentation.completion_choice_prompt,
        sources: presentation.sources.map((source) => ({
            title: source.title, url: source.url, publisher: source.publisher, publishedAt: source.published_at,
            rights: source.rights, anchor: source.anchor, excerpt: source.excerpt, concepts: [...source.concepts],
        })),
        feedbackGuidance: presentation.feedback_guidance ? {
            purpose: presentation.feedback_guidance.purpose, evidence: presentation.feedback_guidance.evidence,
            nextAction: presentation.feedback_guidance.next_action,
            responseFeedback: presentation.feedback_guidance.response_feedback,
            independentCheckPrompt: presentation.feedback_guidance.independent_check_prompt,
            independentCheckFeedback: presentation.feedback_guidance.independent_check_feedback,
            rubric: [...presentation.feedback_guidance.rubric],
        } : null,
        configuredItems: presentation.configured_items.map(toSourcePlaybackItem),
        configuredTool: presentation.configured_tool ? toSourcePlaybackTool(presentation.configured_tool) : null,
        configuredSounds: presentation.configured_sounds.map((sound) => ({
            id: sound.id, slug: sound.slug, name: sound.name, icon: sound.icon,
            url: sound.url, volume: sound.volume, playSeconds: sound.play_seconds, loop: sound.looped,
        })),
        dialogueTypingSoundSets: presentation.dialogue_typing_sound_sets.map((set) => ({
            id: set.id, name: set.name, isDefault: set.is_default,
            sounds: Object.fromEntries(Object.entries(set.sounds).map(([letter, sound]) => [letter, { ...sound }])),
        })),
        npcDialogueNodes: presentation.npc_dialogue_nodes.map((node) => ({
            id: node.id, title: node.title, body: node.body, type: node.node_type, config: node.config,
        })),
        npcDialogueTransitions: presentation.npc_dialogue_transitions.map((edge) => ({
            id: edge.id, fromNodeId: edge.from_node_id, toNodeId: edge.to_node_id,
            fromConnector: edge.from_connector, toConnector: edge.to_connector,
        })),
        question: presentation.question ? {
            id: presentation.question.activity_id, prompt: presentation.question.prompt,
            allowMultiple: presentation.question.allow_multiple,
            options: presentation.question.options.map((option) => ({
                id: option.key, label: option.label, body: option.body,
                outcomeKey: option.outcome_key, weights: option.weights,
            })),
        } : null,
        reviewContext: activity.review_context?.map((entry) => ({
            id: entry.id, question: entry.question, reflection: entry.reflection, createdAt: entry.created_at,
        })) ?? null,
        sharedTaskState: activity.shared_task_state ? toSourceSharedTaskState(activity.shared_task_state) : null,
        transitions: activity.transitions.map((edge) => ({
            id: edge.id, fromConnector: edge.from_connector, toConnector: edge.to_connector,
            toActivityId: edge.to_activity_id, trigger: edge.trigger, triggerValue: edge.trigger_value, label: edge.label,
        })),
    };
}

export function toSourcePlaybackItem(item: Schema['LearnerItem']) {
    return {
        id: item.id, slug: item.slug, title: item.title, description: item.description, config: item.config,
        imageDark: item.image_dark, imageLight: item.image_light, quantity: item.quantity,
    };
}

export function toSourcePlaybackTool(tool: Schema['LearnerTool']) {
    return {
        id: tool.id, slug: tool.slug, title: tool.title, description: tool.description, config: tool.config,
        imageDark: tool.image_dark, imageLight: tool.image_light,
        animationDark: tool.animation_dark, animationLight: tool.animation_light,
    };
}

export function toSourceSharedTaskState(state: Schema['LearnerSharedTaskState']) {
    return {
        acceptedCount: state.accepted_count, threshold: state.threshold, remaining: state.remaining,
        isComplete: state.is_complete, latestSubmissionAt: state.latest_submission_at,
        canShareContributions: state.can_share_contributions, hasSubmitted: state.has_submitted,
        submission: state.submission ? {
            id: state.submission.id, body: state.submission.body, projectStep: state.submission.project_step,
            revisedBody: state.submission.revised_body, revisedAt: state.submission.revised_at,
            canRevise: state.submission.can_revise,
        } : null,
        contributions: state.contributions.map((entry) => ({
            body: entry.body, projectStep: entry.project_step, submittedAt: entry.submitted_at,
            taskKind: entry.task_kind, truncated: entry.truncated,
        })),
        peerReview: state.peer_review ? {
            enabled: state.peer_review.enabled, prompt: state.peer_review.prompt, hasReviewed: state.peer_review.has_reviewed,
            submittedReview: state.peer_review.submitted_review ? {
                id: state.peer_review.submitted_review.id, body: state.peer_review.submitted_review.body,
                projectStep: state.peer_review.submitted_review.project_step,
                responseType: state.peer_review.submitted_review.response_type,
                createdAt: state.peer_review.submitted_review.created_at,
            } : null,
            reviewableContributions: state.peer_review.reviewable_contributions.map((entry) => ({
                id: entry.id, body: entry.body, projectStep: entry.project_step,
                taskKind: entry.task_kind, truncated: entry.truncated,
            })),
            receivedReviews: state.peer_review.received_reviews.map((entry) => ({
                id: entry.id, body: entry.body, projectStep: entry.project_step, responseType: entry.response_type,
                canMarkHelpful: entry.can_mark_helpful, isHelpful: entry.is_helpful,
                createdAt: entry.created_at, followUp: entry.follow_up,
            })),
        } : null,
    };
}

export function toSourceActivityReceipt(receipt: Schema['LearnerPlaybackActivityState'], activity: Activity) {
    if (receipt.activity_id !== activity.id ||
        (receipt.progress && receipt.progress.activity_id !== activity.id)) return unavailable();
    return receipt.progress ? {
        activityId: receipt.activity_id, status: receipt.progress.status, completedAt: receipt.progress.completed_at,
        metadata: toActivityMetadata(activity, receipt.item_obstacle, receipt.obstacle_resolved_at),
    } : null;
}

function toActivityMetadata(activity: Activity, item: Schema['LearnerItemObstacleState'] | null, resolved: string | null) {
    return {
        ...(item ? { itemObstacle: toSourceItemObstacleState(item, activity.presentation.configured_items) } : {}),
        ...(resolved ? { obstacle: { destroyedAt: resolved } } : {}),
    };
}

export function toSourceItemObstacleState(state: Schema['LearnerItemObstacleState'], items: Schema['LearnerItem'][]) {
    const bySlug = new Map(items.map((item) => [item.slug, item.id]));
    return {
        conditionsMet: state.conditions_met, lockedUntil: state.locked_until,
        ...(state.can_continue !== null ? { canContinue: state.can_continue } : {}),
        // Source only consumes itemId. Native storage has no filledAt; do not
        // invent a timestamp to satisfy an unused legacy type declaration.
        filledSlots: Object.fromEntries(state.filled_slots.map((slot) => [
            String(slot.slot_index), { itemId: required(bySlug.get(slot.item_slug)) },
        ])),
    };
}

function sourceConfig(activity: Activity): Record<string, unknown> {
    const config = record(activity.config);
    const result = { ...config };
    // These are projected, authorized learning-area facts, not a client lookup.
    if (config.competenceTopics === undefined) {
        result.competenceTopics = activity.check_in.learning_areas.map((area) => ({ topic: area.name, slug: area.slug }));
    }
    if (activity.activity_type === 'tool_grant' && activity.presentation.configured_tool) {
        result.toolId = activity.presentation.configured_tool.id;
    }
    const key = activity.activity_type === 'item_grant' ? 'items' : activity.activity_type === 'item_obstacle' ? 'slots' : null;
    if (key && Array.isArray(config[key])) {
        const items = new Map(activity.presentation.configured_items.flatMap((item) => [[item.slug, item.id], [item.id, item.id]]));
        result[key] = config[key].map((value) => {
            const slot = record(value);
            return { ...slot, itemId: required(items.get(String(slot.itemId))) };
        });
    }
    return result;
}

function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return unavailable();
    return value as Record<string, unknown>;
}

function required<T>(value: T | null | undefined): T {
    return value ?? unavailable();
}

function unavailable(): never {
    throw new JsonRequestError('The player projection is currently unavailable.', 503);
}
