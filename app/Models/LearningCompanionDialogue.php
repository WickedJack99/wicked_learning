<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'dialogue_graph', 'created_by_user_id', 'updated_by_user_id'])]
class LearningCompanionDialogue extends Model
{
    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['dialogue_graph' => 'array'];
    }

    /** @return HasMany<LearningCompanionDialogueAssignment, $this> */
    public function assignments(): HasMany
    {
        return $this->hasMany(LearningCompanionDialogueAssignment::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /** @return BelongsTo<User, $this> */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_user_id');
    }
}
