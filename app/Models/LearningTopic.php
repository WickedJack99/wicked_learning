<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'learning_topic_area_id',
    'parent_id',
    'slug',
    'title',
    'description',
    'content',
    'is_published',
])]
class LearningTopic extends Model
{
    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /** @return BelongsTo<LearningTopicArea, $this> */
    public function area(): BelongsTo
    {
        return $this->belongsTo(LearningTopicArea::class, 'learning_topic_area_id');
    }

    /** @return BelongsTo<LearningTopic, $this> */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    /** @return HasMany<LearningTopic, $this> */
    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('title');
    }
}
