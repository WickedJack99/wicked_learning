<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/** A learner's anonymous, bounded response to one shared-task contribution. */
#[Fillable(['learning_activity_id', 'learning_shared_task_submission_id', 'user_id', 'body', 'response_type', 'project_step_index', 'helpful_at'])]
class LearningSharedTaskReview extends Model
{
    protected function casts(): array
    {
        return [
            'project_step_index' => 'integer',
            'helpful_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<LearningActivity, $this> */
    public function activity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'learning_activity_id');
    }

    /** @return BelongsTo<LearningSharedTaskSubmission, $this> */
    public function submission(): BelongsTo
    {
        return $this->belongsTo(LearningSharedTaskSubmission::class, 'learning_shared_task_submission_id');
    }

    /** @return HasOne<LearningSharedTaskReviewFollowUp, $this> */
    public function followUp(): HasOne
    {
        return $this->hasOne(LearningSharedTaskReviewFollowUp::class, 'learning_shared_task_review_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
