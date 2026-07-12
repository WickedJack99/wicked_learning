<?php

namespace App\Learning\Serializers;

use App\Models\LearningItem;

class LearningItemSerializer
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
            'quantity' => $this->quantity($item),
        ];
    }

    private function quantity(LearningItem $item): int
    {
        $quantity = $item->pivot?->quantity ?? null;

        return is_numeric($quantity) ? max(0, (int) $quantity) : 0;
    }
}
