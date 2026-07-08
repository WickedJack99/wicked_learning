<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'learning_activity_id',
    'npc_dialogue_node_id',
    'answer_key',
    'answer_label',
    'is_correct',
    'feedback',
])]
class NpcDialogueAnswer extends Model
{
    protected function casts(): array
    {
        return [
            'is_correct' => 'boolean',
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
     * @return BelongsTo<NpcDialogueNode, $this>
     */
    public function dialogueNode(): BelongsTo
    {
        return $this->belongsTo(NpcDialogueNode::class, 'npc_dialogue_node_id');
    }
}
