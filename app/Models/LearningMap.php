<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'learning_world_id',
    'slug',
    'title',
    'description',
    'background_config',
    'grid_config',
    'time_background_enabled',
])]
class LearningMap extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'background_config' => 'array',
            'grid_config' => 'array',
            'time_background_enabled' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<LearningWorld, $this>
     */
    public function world(): BelongsTo
    {
        return $this->belongsTo(LearningWorld::class, 'learning_world_id');
    }

    /**
     * @return HasMany<LearningNode, $this>
     */
    public function nodes(): HasMany
    {
        return $this->hasMany(LearningNode::class);
    }
}
