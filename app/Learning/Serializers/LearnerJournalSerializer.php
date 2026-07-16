<?php

namespace App\Learning\Serializers;

use App\Models\LearnerJournalPage;
use App\Models\LearnerReflection;

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
            'reflectionCount' => $page->reflections_count ?? $page->reflections()->count(),
            'latestReflection' => $page->relationLoaded('reflections') && $page->reflections->first() instanceof LearnerReflection
                ? $this->reflection($page->reflections->first())
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
}
