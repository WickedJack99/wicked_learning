<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'changed_by',
    'description',
    'learning_world_id',
    'title',
])]
class LearningWorldVersion extends Model
{
    /** @return BelongsTo<LearningWorld, $this> */
    public function world(): BelongsTo
    {
        return $this->belongsTo(LearningWorld::class, 'learning_world_id');
    }
}
