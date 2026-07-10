<?php

namespace App\Learning\Serializers;

use App\Models\LearningSound;

class AdminSoundSerializer
{
    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningSound $sound): array
    {
        return [
            'id' => $sound->id,
            'name' => $sound->name,
            'slug' => $sound->slug,
            'icon' => $sound->icon,
            'url' => $sound->url,
            'volume' => $sound->volume,
            'playSeconds' => $sound->play_seconds,
            'loop' => $sound->loop,
        ];
    }
}
