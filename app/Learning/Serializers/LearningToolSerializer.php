<?php

namespace App\Learning\Serializers;

use App\Models\LearningTool;

class LearningToolSerializer
{
    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningTool $tool): array
    {
        return [
            'id' => $tool->id,
            'slug' => $tool->slug,
            'title' => $tool->title,
            'description' => $tool->description,
            'imageDark' => $tool->image_dark,
            'imageLight' => $tool->image_light,
            'animationDark' => $tool->animation_dark,
            'animationLight' => $tool->animation_light,
            'config' => $tool->config ?? [],
        ];
    }
}
