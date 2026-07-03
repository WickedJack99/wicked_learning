<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'learning_activity_id',
    'prompt',
    'feedback_correct',
    'feedback_incorrect',
    'explanation',
    'allow_multiple',
])]
class LearningQuestion extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'allow_multiple' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<LearningActivity, $this>
     */
    public function activity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'learning_activity_id');
    }

    /**
     * @return HasMany<LearningQuestionOption, $this>
     */
    public function options(): HasMany
    {
        return $this->hasMany(LearningQuestionOption::class)->orderBy('sort_order');
    }
}
