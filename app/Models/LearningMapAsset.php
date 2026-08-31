<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'learning_map_id',
    'learning_node_id',
    'image_url',
    'text',
    'position_x',
    'position_y',
    'position_z',
    'width',
    'opacity',
    'locked',
    'focusable',
    'interaction_mode',
    'interaction_config',
    'visual_config',
    'sound_config',
])]
class LearningMapAsset extends Model
{
    protected function casts(): array
    {
        return [
            'position_x' => 'float',
            'position_y' => 'float',
            'position_z' => 'integer',
            'width' => 'float',
            'opacity' => 'float',
            'locked' => 'boolean',
            'focusable' => 'boolean',
            'interaction_config' => 'array',
            'visual_config' => 'array',
            'sound_config' => 'array',
        ];
    }

    /** @return BelongsTo<LearningMap, $this> */
    public function map(): BelongsTo
    {
        return $this->belongsTo(LearningMap::class, 'learning_map_id');
    }

    /** @return BelongsTo<LearningNode, $this> */
    public function node(): BelongsTo
    {
        return $this->belongsTo(LearningNode::class, 'learning_node_id');
    }

    /** @return HasMany<LearningMessageTopic, $this> */
    public function messageTopics(): HasMany
    {
        return $this->hasMany(LearningMessageTopic::class)->orderBy('title');
    }

    /** @return HasMany<LearningMapAssetVersion, $this> */
    public function versions(): HasMany
    {
        return $this->hasMany(LearningMapAssetVersion::class)->latest('created_at')->latest('id');
    }
}
