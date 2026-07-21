<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'learning_group_id',
    'user_id',
    'body',
])]
class LearningGroupMessage extends Model
{
    /**
     * @return BelongsTo<LearningGroup, $this>
     */
    public function group(): BelongsTo
    {
        return $this->belongsTo(LearningGroup::class, 'learning_group_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
