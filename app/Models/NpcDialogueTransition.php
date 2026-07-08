<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'learning_activity_id',
    'from_dialogue_node_id',
    'to_dialogue_node_id',
    'from_connector',
    'to_connector',
])]
class NpcDialogueTransition extends Model
{
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
    public function fromNode(): BelongsTo
    {
        return $this->belongsTo(NpcDialogueNode::class, 'from_dialogue_node_id');
    }

    /**
     * @return BelongsTo<NpcDialogueNode, $this>
     */
    public function toNode(): BelongsTo
    {
        return $this->belongsTo(NpcDialogueNode::class, 'to_dialogue_node_id');
    }
}
