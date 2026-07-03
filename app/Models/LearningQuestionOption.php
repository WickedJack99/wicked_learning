<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'learning_question_id',
    'label',
    'body',
    'is_correct',
    'outcome_key',
    'feedback',
    'weights',
    'sort_order',
])]
class LearningQuestionOption extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_correct' => 'boolean',
            'weights' => 'array',
        ];
    }

    /**
     * @return BelongsTo<LearningQuestion, $this>
     */
    public function question(): BelongsTo
    {
        return $this->belongsTo(LearningQuestion::class, 'learning_question_id');
    }
}
