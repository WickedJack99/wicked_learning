<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Per-learner record that a hidden world-map node has been discovered.
 *
 * @property array<string, mixed>|null $metadata
 */
#[Fillable([
    'user_id',
    'learning_node_id',
    'learning_tool_id',
    'discovered_at',
    'metadata',
])]
class LearnerNodeDiscovery extends Model
{
    protected function casts(): array
    {
        return [
            'discovered_at' => 'datetime',
            'metadata' => 'array',
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
     * @return BelongsTo<LearningTool, $this>
     */
    public function tool(): BelongsTo
    {
        return $this->belongsTo(LearningTool::class, 'learning_tool_id');
    }
}
