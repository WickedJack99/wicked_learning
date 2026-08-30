<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['learning_companion_dialogue_id', 'scope_type', 'scope_id'])]
class LearningCompanionDialogueAssignment extends Model
{
    /** @var list<string> */
    public const SCOPE_TYPES = ['world', 'map', 'node', 'activity'];

    /** @return BelongsTo<LearningCompanionDialogue, $this> */
    public function dialogue(): BelongsTo
    {
        return $this->belongsTo(LearningCompanionDialogue::class, 'learning_companion_dialogue_id');
    }
}
