<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
}
