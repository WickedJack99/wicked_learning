<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'learning_message_topic_id',
    'user_id',
    'body',
    'audience',
    'hidden_at',
    'hidden_by_user_id',
])]
class LearnerMessage extends Model
{
    protected function casts(): array
    {
        return ['hidden_at' => 'datetime'];
    }

    /** @return BelongsTo<LearningMessageTopic, $this> */
    public function topic(): BelongsTo
    {
        return $this->belongsTo(LearningMessageTopic::class, 'learning_message_topic_id');
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
