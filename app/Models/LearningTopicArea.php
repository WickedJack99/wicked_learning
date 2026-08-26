<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['slug', 'title', 'description', 'sort_order'])]
class LearningTopicArea extends Model
{
    /** @return HasMany<LearningTopic, $this> */
    public function topics(): HasMany
    {
        return $this->hasMany(LearningTopic::class)->orderBy('title');
    }

    /** @return HasMany<LearningTopic, $this> */
    public function rootTopics(): HasMany
    {
        return $this->topics()->whereNull('parent_id');
    }
}
