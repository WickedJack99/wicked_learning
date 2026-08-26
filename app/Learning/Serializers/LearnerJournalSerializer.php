<?php

namespace App\Learning\Serializers;

use App\Models\LearnerJournalPage;
use App\Models\LearnerReflection;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningTopic;
use DateTimeInterface;

/** Shapes private journal data for the learner-facing overlay. */
class LearnerJournalSerializer
{
    /** @return array<string, mixed> */
    public function page(LearnerJournalPage $page): array
    {
        return [
            'id' => $page->id,
            'title' => $page->title,
            'topic' => $page->topic,
            'subtopic' => $page->subtopic === '' ? null : $page->subtopic,
            'markdown' => $page->markdown,
            'preferredMode' => $page->preferred_mode,
            'expertAccessRequested' => $page->expert_access_requested,
            'feedbackRequest' => $page->relationLoaded('feedbackRequest') && $page->feedbackRequest !== null
                ? [
                    'domain' => [
                        'type' => $page->feedbackRequest->domain_type,
                        'id' => $page->feedbackRequest->domain_id,
                        'label' => $page->feedbackRequest->domain_label,
                    ],
                    'feedback' => $page->feedbackRequest->feedback,
                    'requestedAt' => $this->date($page->feedbackRequest->requested_at),
                    'respondedAt' => $this->date($page->feedbackRequest->responded_at),
                    'status' => $page->feedbackRequest->responded_at === null ? 'pending' : 'responded',
                ]
                : null,
            'reflectionCount' => $page->reflections_count ?? $page->reflections()->count(),
            'latestReflection' => $page->relationLoaded('reflections') && $page->reflections->first() instanceof LearnerReflection
                ? $this->reflection($page->reflections->first())
                : null,
            'learningContext' => $page->relationLoaded('reflections') && $page->reflections->first() instanceof LearnerReflection
                ? $this->learningContext($page->reflections->first())
                : null,
            'updatedAt' => $page->updated_at?->toIso8601String(),
        ];
    }

    /** @return array<string, mixed> */
    public function reflection(LearnerReflection $reflection): array
    {
        return [
            'id' => $reflection->id,
            'title' => $reflection->title,
            'question' => $reflection->question,
            'reflection' => $reflection->reflection,
            'feedbackStatus' => $reflection->feedback_status,
            'expertFeedback' => $reflection->expert_feedback,
            'createdAt' => $reflection->created_at?->toIso8601String(),
        ];
    }

    /** @return array<string, mixed>|null */
    private function learningContext(LearnerReflection $reflection): ?array
    {
        $node = $reflection->learningNode;

        if (! $node instanceof LearningNode) {
            return null;
        }

        $node->loadMissing('map.topic');
        $map = $node->map;

        if (! $map instanceof LearningMap) {
            return null;
        }

        $topic = $map->topic instanceof LearningTopic && $map->topic->is_published
            ? [
                'href' => route('topics.show', $map->topic, false),
                'title' => $map->topic->title,
            ]
            : null;

        return [
            'activityHref' => $reflection->learning_activity_id === null
                ? null
                : route('learning.nodes.play', [
                    'activity_id' => $reflection->learning_activity_id,
                    'node' => $node,
                ], false),
            'activityTitle' => $reflection->learningActivity?->title,
            'mapHref' => route('world', [
                'focused' => $node->slug,
                'map' => $map->slug,
            ], false),
            'mapTitle' => $map->title,
            'nodeHref' => route('learning.nodes.play', ['node' => $node], false),
            'nodeTitle' => $node->title,
            'topic' => $topic,
        ];
    }

    private function date(DateTimeInterface|string|null $value): ?string
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }

        return $value;
    }
}
