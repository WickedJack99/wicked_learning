<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'learning_node_id',
    'learning_activity_id',
    'label',
    'image_dark',
    'image_light',
    'button_color_dark',
    'button_border_color_dark',
    'button_color_light',
    'button_border_color_light',
    'sort_order',
])]
class LearningActivityStart extends Model
{
    /**
     * @return BelongsTo<LearningNode, $this>
     */
    public function node(): BelongsTo
    {
        return $this->belongsTo(LearningNode::class, 'learning_node_id');
    }

    /**
     * @return BelongsTo<LearningActivity, $this>
     */
    public function activity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'learning_activity_id');
    }
}
