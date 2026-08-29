<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'learning_activity_id',
    'play_run_id',
    'topic_slug',
    'topic_name',
    'evidence_type',
    'learning_purpose',
    'contribution',
    'outcome',
    'confidence',
    'attempt_number',
    'assistance_level',
])]
class LearnerEvidenceEvent extends Model
{
    protected function casts(): array
    {
        return [
            'contribution' => 'float',
            'attempt_number' => 'integer',
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
}
