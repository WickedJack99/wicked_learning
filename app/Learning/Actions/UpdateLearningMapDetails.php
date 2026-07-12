<?php

namespace App\Learning\Actions;

use App\Models\LearningMap;

class UpdateLearningMapDetails
{
    /**
     * @param array<string, mixed> $data
     */
    public function handle(LearningMap $map, array $data): void
    {
        $map->forceFill([
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
        ])->save();
    }
}
