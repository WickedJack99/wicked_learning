<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property array<string, mixed>|null $config
 */
#[Fillable([
    'learning_activity_id',
    'type',
    'title',
    'body',
    'config',
    'sort_order',
    'graph_position_x',
    'graph_position_y',
])]
class NpcDialogueNode extends Model
{
    protected function casts(): array
    {
        return [
            'config' => 'array',
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
     * @return HasMany<NpcDialogueTransition, $this>
     */
    public function outgoingTransitions(): HasMany
    {
        return $this->hasMany(NpcDialogueTransition::class, 'from_dialogue_node_id');
    }

    /**
     * @return HasMany<NpcDialogueTransition, $this>
     */
    public function incomingTransitions(): HasMany
    {
        return $this->hasMany(NpcDialogueTransition::class, 'to_dialogue_node_id');
    }
}
