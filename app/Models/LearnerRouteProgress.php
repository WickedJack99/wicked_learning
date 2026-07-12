<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'learning_node_id',
    'learning_activity_start_id',
    'start_learning_activity_id',
    'current_learning_activity_id',
    'current_play_run_id',
    'status',
    'completion_count',
    'reset_count',
    'started_at',
    'last_entered_at',
    'last_exited_at',
    'completed_at',
    'last_completed_at',
    'metadata',
])]
class LearnerRouteProgress extends Model
{
    protected $table = 'learner_route_progress';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'completed_at' => 'datetime',
            'last_completed_at' => 'datetime',
            'last_entered_at' => 'datetime',
            'last_exited_at' => 'datetime',
            'metadata' => 'array',
            'started_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<LearningNode, $this>
     */
    public function node(): BelongsTo
    {
        return $this->belongsTo(LearningNode::class, 'learning_node_id');
    }

    /**
     * @return BelongsTo<LearningActivityStart, $this>
     */
    public function activityStart(): BelongsTo
    {
        return $this->belongsTo(LearningActivityStart::class, 'learning_activity_start_id');
    }

    /**
     * @return BelongsTo<LearningActivity, $this>
     */
    public function currentActivity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'current_learning_activity_id');
    }
}
