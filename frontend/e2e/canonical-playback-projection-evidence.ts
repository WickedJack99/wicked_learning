import { expect } from '@playwright/test';
import type { components } from '../src/platform/api/schema';
import { toPlaybackPageProps } from '../src/platform/playback-projection';

/** Exercise the data adapter with real Rust documents, including populated
 * private state. This is not a UI activation or screenshot parity claim. */
export function verifyPlaybackProjection(document: components['schemas']['LearnerPlaybackDocument']) {
    const props = toPlaybackPageProps(document);
    expect(props).toMatchObject({
        playRunId: document.play_run_id, playActivityId: document.activity.id,
        playRouteId: document.start_id, isBookmarked: document.node.is_bookmarked,
        node: { id: document.node.id, mapId: document.node.map_id },
    });
    expect(props.node.activities.map((activity) => activity.id)).toEqual(document.graph.activities.map((activity) => activity.id));
    const serialized = JSON.stringify(document);
    expect(toPlaybackPageProps(document)).toEqual(props);
    expect(JSON.stringify(document)).toBe(serialized);
    expect(Object.keys(props.progress.activities)).toEqual(document.private_state.activities.map((p) => p.activity_id));
    expect(Object.keys(props.progress.answers)).toEqual(document.private_state.answers.map((p) => p.activity_id));
    if (document.node.topic) {
        expect(props.node.topic?.href).toBe(`/topics/${encodeURIComponent(document.node.topic.slug)}`);
        expect(props.node.topic?.competenceHref).toBe(`/competence?topic=${encodeURIComponent(document.node.topic.slug)}`);
        expect(props.node.topic?.href).not.toBe(props.node.topic?.competenceHref);
    }
    for (const saved of document.private_state.answers) {
        const answer = props.progress.answers[saved.activity_id];
        const question = props.node.activities.find((activity) => activity.id === saved.activity_id)!.question!;
        expect(answer.optionIds.every((id) => question.options.some((option) => option.id === id))).toBe(true);
        expect(answer.feedback).toBe(saved.feedback);
        expect(answer.nextActivityId).toBe(saved.next_activity_id);
        expect(answer.earlierAttempts.map((entry) => entry.answeredAt)).toEqual(saved.earlier_attempts.map((entry) => entry.answered_at));
    }
    for (const saved of document.private_state.npc_dialogues) {
        expect(props.playState[saved.activity_id]).toEqual({ npcDialogue: { currentNodeId: saved.current_node_id, history: saved.history } });
    }
    for (const saved of document.private_state.shared_task_checklists) {
        expect(props.playState[saved.activity_id].sharedTask).toEqual({ completedStepIndexes: saved.completed_step_indexes });
    }
    for (const native of document.graph.activities) {
        const activity = props.node.activities.find((entry) => entry.id === native.id)!;
        // Complete LearningActivitySerializer surface, not a card-only subset.
        expect(Object.keys(activity).sort()).toEqual([
            'id', 'slug', 'type', 'title', 'introduction', 'timeGuideMinutes', 'config',
            'configuredItems', 'configuredSounds', 'configuredTool', 'dialogueTypingSoundSets',
            'evidenceContext', 'sources', 'completionChoicePrompt', 'feedbackGuidance',
            'npcDialogueNodes', 'npcDialogueTransitions', 'question', 'reviewContext',
            'sharedTaskState', 'transitions',
        ].sort());
        expect(activity.transitions.map((edge) => edge.toActivityId)).toEqual(native.transitions.map((edge) => edge.to_activity_id));
        expect(activity.configuredSounds.map((sound) => sound.id)).toEqual(native.presentation.configured_sounds.map((sound) => sound.id));
        expect(activity.sources.map((source) => source.publishedAt)).toEqual(native.presentation.sources.map((source) => source.published_at));
        expect(activity.reviewContext?.map((review) => review.reflection) ?? null).toEqual(native.review_context?.map((review) => review.reflection) ?? null);
        if (native.shared_task_state) {
            expect(activity.sharedTaskState?.submission?.canRevise).toBe(native.shared_task_state.submission?.can_revise);
            expect(activity.sharedTaskState?.peerReview?.receivedReviews.map((review) => review.followUp)).toEqual(native.shared_task_state.peer_review?.received_reviews.map((review) => review.follow_up));
            expect(activity.sharedTaskState?.contributions.map((entry) => entry.body)).toEqual(native.shared_task_state.contributions.map((entry) => entry.body));
        }
    }
    // Inconsistent successful payloads must not turn into plausible empty props.
    const brokenNode = structuredClone(document);
    brokenNode.graph.node_id = 'unrelated-node';
    expect(() => toPlaybackPageProps(brokenNode)).toThrow('player projection is currently unavailable');
    const missingActive = structuredClone(document);
    missingActive.graph.activities = missingActive.graph.activities.filter((activity) => activity.id !== document.activity.id);
    expect(() => toPlaybackPageProps(missingActive)).toThrow('player projection is currently unavailable');
    const question = document.graph.activities.find((activity) => activity.presentation.question);
    if (question) {
        const unknownAnswer = structuredClone(document);
        unknownAnswer.private_state.answers = [{
            activity_id: question.id, selected_option_keys: ['absent-key'], is_correct: true,
            attempt_number: 1, confidence: null, calibration: null, feedback: null,
            explanation: null, next_activity_id: null, next_transition_label: null, earlier_attempts: [],
        }];
        expect(() => toPlaybackPageProps(unknownAnswer)).toThrow('player projection is currently unavailable');
    }
    const withItems = document.graph.activities.find((activity) =>
        ['item_grant', 'item_obstacle'].includes(activity.activity_type) && activity.presentation.configured_items.length);
    if (withItems) {
        const missingItem = structuredClone(document);
        missingItem.graph.activities.find((activity) => activity.id === withItems.id)!.presentation.configured_items = [];
        expect(() => toPlaybackPageProps(missingItem)).toThrow('player projection is currently unavailable');
    }
    return props;
}
