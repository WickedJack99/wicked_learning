<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'learning_question_id',
    'learning_question_option_id',
    'is_correct',
    'confidence',
    'calibration',
    'selected_option_ids',
    'feedback',
])]
class LearnerQuestionAnswer extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_correct' => 'boolean',
            'selected_option_ids' => 'array',
        ];
    }

    /**
     * @return BelongsTo<LearningQuestion, $this>
     */
    public function question(): BelongsTo
    {
        return $this->belongsTo(LearningQuestion::class, 'learning_question_id');
    }

    /**
     * @return BelongsTo<LearningQuestionOption, $this>
     */
    public function selectedOption(): BelongsTo
    {
        return $this->belongsTo(LearningQuestionOption::class, 'learning_question_option_id');
    }
}
