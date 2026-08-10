<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['learning_map_asset_id', 'slug', 'title'])]
class LearningMessageTopic extends Model
{
    /** @return BelongsTo<LearningMapAsset, $this> */
    public function mapAsset(): BelongsTo
    {
        return $this->belongsTo(LearningMapAsset::class, 'learning_map_asset_id');
    }

    /** @return HasMany<LearnerMessage, $this> */
    public function messages(): HasMany
    {
        return $this->hasMany(LearnerMessage::class)->latest();
    }
}
