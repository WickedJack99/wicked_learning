<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'source_learning_node_id',
    'target_learning_node_id',
    'source_learning_activity_id',
    'target_learning_activity_id',
    'label',
    'description',
    'config',
])]
class LearningPortalLink extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'config' => 'array',
        ];
    }

    /**
     * @return BelongsTo<LearningNode, $this>
     */
    public function sourceNode(): BelongsTo
    {
        return $this->belongsTo(LearningNode::class, 'source_learning_node_id');
    }

    /**
     * @return BelongsTo<LearningNode, $this>
     */
    public function targetNode(): BelongsTo
    {
        return $this->belongsTo(LearningNode::class, 'target_learning_node_id');
    }

    /**
     * @return BelongsTo<LearningActivity, $this>
     */
    public function sourceActivity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'source_learning_activity_id');
    }

    /**
     * @return BelongsTo<LearningActivity, $this>
     */
    public function targetActivity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'target_learning_activity_id');
    }
}
