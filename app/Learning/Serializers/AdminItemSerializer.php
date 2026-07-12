<?php

namespace App\Learning\Serializers;

use App\Models\LearningItem;

class AdminItemSerializer
{
    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningItem $item): array
    {
        return [
            'id' => $item->id,
            'slug' => $item->slug,
            'title' => $item->title,
            'description' => $item->description,
            'imageDark' => $item->image_dark,
            'imageLight' => $item->image_light,
            'config' => $item->config ?? [],
        ];
    }
}
