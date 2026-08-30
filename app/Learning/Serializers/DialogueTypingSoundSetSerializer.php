<?php

namespace App\Learning\Serializers;

use App\Models\LearningDialogueSound;
use App\Models\LearningDialogueSoundSet;

class DialogueTypingSoundSetSerializer
{
    /**
     * @return array<string, mixed>
     */
    public function admin(LearningDialogueSoundSet $set): array
    {
        return [
            'id' => $set->id,
            'name' => $set->name,
            'slug' => $set->slug,
            'tags' => $set->tags ?? [],
            'isDefault' => $set->is_default,
            'soundCount' => $set->sounds->count(),
            'letters' => $set->sounds->pluck('letter')->values()->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function learner(LearningDialogueSoundSet $set): array
    {
        return [
            'id' => $set->id,
            'name' => $set->name,
            'isDefault' => $set->is_default,
            'sounds' => $set->sounds
                ->mapWithKeys(fn (LearningDialogueSound $sound): array => [
                    $sound->letter => [
                        'id' => $sound->id,
                        'letter' => $sound->letter,
                        'url' => $sound->url,
                        'volume' => $sound->volume,
                    ],
                ])
                ->all(),
        ];
    }
}
