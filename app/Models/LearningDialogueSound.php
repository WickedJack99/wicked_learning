<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['learning_dialogue_sound_set_id', 'letter', 'url', 'volume'])]
class LearningDialogueSound extends Model
{
    protected function casts(): array
    {
        return [
            'volume' => 'float',
        ];
    }

    /**
     * @return BelongsTo<LearningDialogueSoundSet, $this>
     */
    public function soundSet(): BelongsTo
    {
        return $this->belongsTo(LearningDialogueSoundSet::class, 'learning_dialogue_sound_set_id');
    }
}
