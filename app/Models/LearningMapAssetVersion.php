<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'changed_by',
    'focusable',
    'image_url',
    'interaction_config',
    'interaction_mode',
    'learning_map_asset_id',
    'locked',
    'opacity',
    'position_x',
    'position_y',
    'position_z',
    'sound_config',
    'text',
    'visual_config',
    'width',
])]
class LearningMapAssetVersion extends Model
{
    protected function casts(): array
    {
        return [
            'focusable' => 'boolean',
            'locked' => 'boolean',
            'opacity' => 'float',
            'position_x' => 'float',
            'position_y' => 'float',
            'position_z' => 'integer',
            'width' => 'float',
            'interaction_config' => 'array',
            'visual_config' => 'array',
            'sound_config' => 'array',
        ];
    }

    /** @return BelongsTo<LearningMapAsset, $this> */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(LearningMapAsset::class, 'learning_map_asset_id');
    }
}
