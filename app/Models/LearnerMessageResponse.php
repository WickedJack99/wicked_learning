<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'learner_message_id',
    'user_id',
    'body',
    'response_type',
    'helpful_at',
    'hidden_at',
    'hidden_by_user_id',
])]
class LearnerMessageResponse extends Model
{
    protected function casts(): array
    {
        return [
            'helpful_at' => 'datetime',
            'hidden_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<LearnerMessage, $this> */
    public function message(): BelongsTo
    {
        return $this->belongsTo(LearnerMessage::class, 'learner_message_id');
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** @return BelongsTo<User, $this> */
    public function hiddenBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hidden_by_user_id');
    }
}
