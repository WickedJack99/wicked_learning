<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'slug', 'tags', 'is_default'])]
class LearningDialogueSoundSet extends Model
{
    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'tags' => 'array',
        ];
    }

    /**
     * @return HasMany<LearningDialogueSound, $this>
     */
    public function sounds(): HasMany
    {
        return $this->hasMany(LearningDialogueSound::class)
            ->orderBy('letter');
    }
}
