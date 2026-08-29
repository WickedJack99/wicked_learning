<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'learning_question_id',
])]
class LearnerRecallItem extends Model
{
    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<LearningQuestion, $this>
     */
    public function question(): BelongsTo
    {
        return $this->belongsTo(LearningQuestion::class, 'learning_question_id');
    }
}
