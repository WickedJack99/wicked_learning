<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An immutable record of one author-requested AI activity review.
 */
#[Fillable([
    'learning_activity_id',
    'ai_agent_template_id',
    'reviewed_by_user_id',
    'contract_version',
    'provider',
    'model',
    'review',
    'input_tokens',
    'output_tokens',
    'total_tokens',
])]
class LearningActivityReviewRun extends Model
{
    protected function casts(): array
    {
        return [
            'review' => 'array',
            'input_tokens' => 'integer',
            'output_tokens' => 'integer',
            'total_tokens' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<LearningActivity, $this>
     */
    public function activity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'learning_activity_id');
    }

    /**
     * @return BelongsTo<AiAgentTemplate, $this>
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(AiAgentTemplate::class, 'ai_agent_template_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }
}
