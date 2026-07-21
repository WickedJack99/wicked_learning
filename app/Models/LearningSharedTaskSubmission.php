<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A learner contribution to a shared, activity-wide task counter. */
#[Fillable(['learning_activity_id', 'user_id', 'play_run_id', 'body', 'status', 'validation_mode', 'metadata', 'accepted_at'])]
class LearningSharedTaskSubmission extends Model
{
    protected function casts(): array
    {
        return [
            'accepted_at' => 'datetime',
            'metadata' => 'array',
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
