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
    'learning_topic_id',
    'created_by_user_id',
    'updated_by_user_id',
    'slug',
    'title',
    'description',
    'background_config',
    'grid_config',
    'access_roles',
    'time_background_enabled',
    'map_assets_locked',
    'companion_config',
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
            'map_assets_locked' => 'boolean',
            'companion_config' => 'array',
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
     * @return BelongsTo<LearningTopic, $this>
     */
    public function topic(): BelongsTo
    {
        return $this->belongsTo(LearningTopic::class, 'learning_topic_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_user_id');
    }

    /**
     * @return HasMany<LearningNode, $this>
     */
    public function nodes(): HasMany
    {
        return $this->hasMany(LearningNode::class);
    }

    /** @return HasMany<LearningMapAsset, $this> */
    public function assets(): HasMany
    {
        return $this->hasMany(LearningMapAsset::class)->orderBy('position_z')->orderBy('id');
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

    /** @return HasMany<LearningMapVersion, $this> */
    public function versions(): HasMany
    {
        return $this->hasMany(LearningMapVersion::class);
    }
}
