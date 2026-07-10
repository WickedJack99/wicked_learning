<?php

namespace App\Learning\Actions;

use App\Models\LearningSound;
use Illuminate\Support\Str;

class UpdateLearningSound
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningSound $sound, array $data): void
    {
        $sound->forceFill([
            'name' => $data['name'],
            'slug' => $data['slug'] ?: Str::slug($data['name']),
            'icon' => $data['icon'],
            'url' => $data['url'],
            'volume' => $data['volume'],
            'play_seconds' => $data['play_seconds'] ?? null,
            'loop' => $data['loop'],
        ])->save();
    }
}
