<?php

namespace App\Learning\Serializers;

use App\Models\LearningTool;

class AdminToolSerializer
{
    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningTool $tool): array
    {
        $config = $tool->config ?? [];

        return [
            'id' => $tool->id,
            'slug' => $tool->slug,
            'title' => $tool->title,
            'description' => $tool->description,
            'imageDark' => $tool->image_dark,
            'imageLight' => $tool->image_light,
            'animationDark' => $tool->animation_dark,
            'animationLight' => $tool->animation_light,
            'animationDurationSeconds' => $config['animationDurationSeconds'] ?? null,
            'animationWidthPercent' => $config['animationWidthPercent'] ?? null,
            'config' => $config,
            'createdAt' => $tool->created_at?->format(DATE_ATOM),
            'imageWidthPercent' => $config['imageWidthPercent'] ?? 16,
            'updatedAt' => $tool->updated_at?->format(DATE_ATOM),
        ];
    }
}
