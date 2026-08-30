<?php

namespace App\Learning\Queries;

use App\Models\LearningDialogueSoundSet;
use Illuminate\Database\Eloquent\Collection;

class LoadEditableDialogueSoundSets
{
    /**
     * @return Collection<int, LearningDialogueSoundSet>
     */
    public function handle(): Collection
    {
        return LearningDialogueSoundSet::query()
            ->with('sounds')
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get();
    }
}
