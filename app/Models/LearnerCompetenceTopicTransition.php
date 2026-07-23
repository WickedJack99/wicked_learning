<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'from_topic_slug',
    'from_topic_name',
    'to_topic_slug',
    'to_topic_name',
    'transition_count',
])]
class LearnerCompetenceTopicTransition extends Model
{
    protected function casts(): array
    {
        return [
            'transition_count' => 'integer',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
