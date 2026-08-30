<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'learning_activity_id',
    'play_run_id',
    'learner_reflection_id',
    'objective',
    'concepts',
    'topic_slug',
    'topic_name',
    'evidence_type',
    'learning_purpose',
    'evidence_criterion',
    'evidence_rubric',
    'observed_cues',
    'source_references',
    'contribution',
    'outcome',
    'confidence',
    'confidence_after_feedback',
    'calibration',
    'attempt_number',
    'assistance_level',
    'latency_seconds',
])]
class LearnerEvidenceEvent extends Model
{
    protected function casts(): array
    {
        return [
            'contribution' => 'float',
            'attempt_number' => 'integer',
            'latency_seconds' => 'integer',
            'evidence_rubric' => 'array',
            'observed_cues' => 'array',
            'concepts' => 'array',
            'source_references' => 'array',
        ];
    }

    /** @return BelongsTo<LearningActivity, $this> */
    public function activity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'learning_activity_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<LearnerReflection, $this> */
    public function reflection(): BelongsTo
    {
        return $this->belongsTo(LearnerReflection::class, 'learner_reflection_id');
    }
}
