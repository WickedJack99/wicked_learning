<?php

namespace App\Learning\Validation;

use App\Models\LearningTool;
use Illuminate\Validation\Rule;

class AdminToolRules
{
    /**
     * @return array<string, mixed>
     */
    public function store(): array
    {
        return $this->tool();
    }

    /**
     * @return array<string, mixed>
     */
    public function update(LearningTool $tool): array
    {
        return $this->tool($tool);
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
    private function tool(?LearningTool $tool = null): array
    {
        return [
            'title' => [
                'required',
                'string',
                'max:120',
                Rule::unique('learning_tools', 'title')->ignore($tool?->id),
            ],
            'slug' => [
                'nullable',
                'string',
                'max:140',
                Rule::unique('learning_tools', 'slug')->ignore($tool?->id),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
            'image_dark' => ['nullable', 'string', 'max:2048'],
            'image_light' => ['nullable', 'string', 'max:2048'],
            'animation_dark' => ['nullable', 'string', 'max:2048'],
            'animation_light' => ['nullable', 'string', 'max:2048'],
            'animation_duration_seconds' => ['nullable', 'numeric', 'min:0', 'max:600'],
            'animation_width_percent' => ['nullable', 'numeric', 'min:1', 'max:100'],
            'image_width_percent' => ['nullable', 'numeric', 'min:1', 'max:100'],
        ];
    }
}
