<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'user_id',
    'learning_question_id',
    'learning_question_option_id',
    'is_correct',
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
}
