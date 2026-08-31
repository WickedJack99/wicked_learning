<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'changed_by',
    'description',
    'learning_map_id',
    'learning_topic_id',
    'map_assets_locked',
    'title',
])]
class LearningMapVersion extends Model
{
    protected function casts(): array
    {
        return [
            'map_assets_locked' => 'boolean',
        ];
    }

    /** @return BelongsTo<LearningMap, $this> */
    public function map(): BelongsTo
    {
        return $this->belongsTo(LearningMap::class, 'learning_map_id');
    }
}
