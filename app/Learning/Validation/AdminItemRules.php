<?php

namespace App\Learning\Validation;

use App\Models\LearningItem;
use Illuminate\Validation\Rule;

class AdminItemRules
{
    /**
     * @return array<string, mixed>
     */
    public function store(): array
    {
        return $this->item();
    }

    /**
     * @return array<string, mixed>
     */
    public function update(LearningItem $item): array
    {
        return $this->item($item);
    }

    /**
     * @return array<string, mixed>
     */
    public function upload(): array
    {
        return ['file' => ['required', 'file', 'max:10240']];
    }

    /**
     * @return array<string, mixed>
     */
    private function item(?LearningItem $item = null): array
    {
        return [
            'title' => [
                'required',
                'string',
                'max:120',
                Rule::unique('learning_items', 'title')->ignore($item?->id),
            ],
            'slug' => [
                'nullable',
                'string',
                'max:140',
                Rule::unique('learning_items', 'slug')->ignore($item?->id),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
            'image_dark' => ['nullable', 'string', 'max:2048'],
            'image_light' => ['nullable', 'string', 'max:2048'],
        ];
    }
}
