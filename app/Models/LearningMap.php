<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

/**
 * @property array<string, mixed>|null $background_config
 * @property array<string, mixed>|null $grid_config
 * @property array<int, string>|null $access_roles
 */
#[Fillable([
    'learning_world_id',
    'slug',
    'title',
    'description',
    'background_config',
    'grid_config',
    'access_roles',
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
            'access_roles' => 'array',
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

    /**
     * @return BelongsToMany<LearningGroup, $this>
     */
    public function editingGroups(): BelongsToMany
    {
        return $this->belongsToMany(LearningGroup::class, 'learning_group_map_editors')
            ->withTimestamps();
    }

    /**
     * Portal links that start from a node on this map.
     *
     * @return HasManyThrough<LearningPortalLink, LearningNode, $this>
     */
    public function outgoingPortalLinks(): HasManyThrough
    {
        return $this->hasManyThrough(
            LearningPortalLink::class,
            LearningNode::class,
            'learning_map_id',
            'source_learning_node_id',
        );
    }
}
