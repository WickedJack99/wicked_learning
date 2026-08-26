<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** @property array<string, mixed>|null $metadata */
#[Fillable([
    'user_id',
    'learning_node_id',
    'learning_activity_id',
    'status',
    'attempt_count',
    'reached_at',
    'completed_at',
    'metadata',
])]
class LearnerActivityProgress extends Model
{
    protected $table = 'learner_activity_progress';

    /** @return BelongsTo<LearningActivity, $this> */
    public function activity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'learning_activity_id');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'reached_at' => 'datetime',
            'completed_at' => 'datetime',
            'metadata' => 'array',
        ];
    }
}
