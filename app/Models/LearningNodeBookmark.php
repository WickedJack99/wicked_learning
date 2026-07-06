<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'learning_node_id',
])]
class LearningNodeBookmark extends Model
{
    /**
     * @return BelongsTo<LearningNode, $this>
     */
    public function node(): BelongsTo
    {
        return $this->belongsTo(LearningNode::class, 'learning_node_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
