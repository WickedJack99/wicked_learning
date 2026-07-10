<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property array<string, mixed>|null $visual_config
 */
#[Fillable([
    'learning_map_id',
    'slug',
    'title',
    'description',
    'position_q',
    'position_r',
    'state',
    'visual_config',
    'start_activity_id',
])]
class LearningNode extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'visual_config' => 'array',
        ];
    }

    /**
     * @return BelongsTo<LearningMap, $this>
     */
    public function map(): BelongsTo
    {
        return $this->belongsTo(LearningMap::class, 'learning_map_id');
    }

    /**
     * @return BelongsTo<LearningActivity, $this>
     */
    public function startActivity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'start_activity_id');
    }

    /**
     * @return HasMany<LearningActivityStart, $this>
     */
    public function activityStarts(): HasMany
    {
        return $this->hasMany(LearningActivityStart::class)->orderBy('sort_order');
    }

    /**
     * @return HasMany<LearningActivity, $this>
     */
    public function activities(): HasMany
    {
        return $this->hasMany(LearningActivity::class)->orderBy('sort_order');
    }

    /**
     * @return HasMany<LearningPortalLink, $this>
     */
    public function outgoingPortalLinks(): HasMany
    {
        return $this->hasMany(LearningPortalLink::class, 'source_learning_node_id');
    }

    /**
     * @return HasMany<LearningPortalLink, $this>
     */
    public function incomingPortalLinks(): HasMany
    {
        return $this->hasMany(LearningPortalLink::class, 'target_learning_node_id');
    }

    /**
     * @return HasMany<LearningNodeBookmark, $this>
     */
    public function bookmarks(): HasMany
    {
        return $this->hasMany(LearningNodeBookmark::class);
    }

    /**
     * @return HasMany<LearnerNodeDiscovery, $this>
     */
    public function discoveries(): HasMany
    {
        return $this->hasMany(LearnerNodeDiscovery::class);
    }
}
