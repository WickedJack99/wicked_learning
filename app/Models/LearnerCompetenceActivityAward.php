<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'learning_activity_id',
    'play_run_id',
    'topic_slug',
    'topic_name',
    'points',
])]
class LearnerCompetenceActivityAward extends Model
{
    protected function casts(): array
    {
        return [
            'points' => 'float',
        ];
    }

    /** @return BelongsTo<LearningActivity, $this> */
    public function activity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'learning_activity_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
