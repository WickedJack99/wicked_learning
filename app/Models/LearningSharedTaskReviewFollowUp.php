<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A learner's private note about an anonymous shared-task peer response. */
#[Fillable(['learning_activity_id', 'learning_shared_task_review_id', 'user_id', 'body'])]
class LearningSharedTaskReviewFollowUp extends Model
{
    /** @return BelongsTo<LearningActivity, $this> */
    public function activity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'learning_activity_id');
    }

    /** @return BelongsTo<LearningSharedTaskReview, $this> */
    public function review(): BelongsTo
    {
        return $this->belongsTo(LearningSharedTaskReview::class, 'learning_shared_task_review_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
