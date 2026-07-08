<?php

namespace App\Learning\Serializers;

use App\Models\LearningActivityStart;

class LearningActivityStartSerializer
{
    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningActivityStart $start): array
    {
        return [
            'id' => $start->id,
            'activityId' => $start->learning_activity_id,
            'buttonBorderColorDark' => $start->button_border_color_dark,
            'buttonBorderColorLight' => $start->button_border_color_light,
            'buttonColorDark' => $start->button_color_dark,
            'buttonColorLight' => $start->button_color_light,
            'imageDark' => $start->image_dark,
            'imageLight' => $start->image_light,
            'label' => $start->label ?: $start->activity->title,
            'sortOrder' => $start->sort_order,
        ];
    }
}
