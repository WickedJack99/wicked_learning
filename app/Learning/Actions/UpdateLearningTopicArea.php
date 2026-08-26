<?php

namespace App\Learning\Actions;

use App\Models\LearningTopicArea;

class UpdateLearningTopicArea
{
    /** @param array{title: string, description?: string|null} $data */
    public function handle(LearningTopicArea $area, array $data): LearningTopicArea
    {
        $area->update([
            'title' => trim($data['title']),
            'description' => $data['description'] ?? null,
        ]);

        return $area->refresh();
    }
}
