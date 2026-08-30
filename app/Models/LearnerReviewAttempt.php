<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property array<string, mixed>|null $metadata
 * @property list<string>|null $observed_cues
 * @property int|null $latency_seconds
 */
#[Fillable([
    'user_id',
    'learning_activity_id',
    'learner_activity_progress_id',
    'learner_reflection_id',
    'attempt_number',
    'source',
    'outcome',
    'confidence',
    'latency_seconds',
    'confidence_after_feedback',
    'assistance_level',
    'observed_cues',
    'attempted_at',
    'metadata',
])]
class LearnerReviewAttempt extends Model
{
    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<LearningActivity, $this> */
    public function activity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'learning_activity_id');
    }

    /** @return BelongsTo<LearnerActivityProgress, $this> */
    public function progress(): BelongsTo
    {
        return $this->belongsTo(LearnerActivityProgress::class, 'learner_activity_progress_id');
    }

    /** @return BelongsTo<LearnerReflection, $this> */
    public function reflection(): BelongsTo
    {
        return $this->belongsTo(LearnerReflection::class, 'learner_reflection_id');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'attempt_number' => 'integer',
            'latency_seconds' => 'integer',
            'attempted_at' => 'datetime',
            'metadata' => 'array',
            'observed_cues' => 'array',
        ];
    }
}
