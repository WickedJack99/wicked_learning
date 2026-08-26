<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;

class LearningActivityReviewState
{
    /**
     * @var list<string>
     */
    private const CONTENT_FIELDS = [
        'config',
        'introduction',
        'slug',
        'title',
        'type',
    ];

    public function hasContentChanges(LearningActivity $activity): bool
    {
        return $activity->isDirty(self::CONTENT_FIELDS);
    }

    public function markNeedsReview(LearningActivity $activity): void
    {
        $activity->forceFill([
            'ai_review_status' => LearningActivity::AI_REVIEW_STATUS_NEEDS_REVIEW,
            'ai_reviewed_at' => null,
        ])->save();
    }
}
