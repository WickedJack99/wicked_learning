<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A learner-owned markdown page, organized with a topic and optional subtopic. */
#[Fillable(['user_id', 'title', 'topic', 'subtopic', 'markdown', 'preferred_mode', 'expert_access_requested'])]
class LearnerJournalPage extends Model
{
    protected function casts(): array
    {
        return ['expert_access_requested' => 'boolean'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<LearnerReflection, $this> */
    public function reflections(): HasMany
    {
        return $this->hasMany(LearnerReflection::class)->latest();
    }
}
