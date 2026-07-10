<?php

namespace App\Learning\Validation;

use App\Models\LearningSound;
use Illuminate\Validation\Rule;

class AdminSoundRules
{
    /**
     * @return array<string, mixed>
     */
    public function store(): array
    {
        return $this->sound();
    }

    /**
     * @return array<string, mixed>
     */
    public function update(LearningSound $sound): array
    {
        return $this->sound($sound);
    }

    /**
     * @return array<string, mixed>
     */
    public function upload(): array
    {
        return ['file' => ['required', 'file', 'max:20480']];
    }

    /**
     * @return array<string, mixed>
     */
    private function sound(?LearningSound $sound = null): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'slug' => [
                'nullable',
                'string',
                'max:140',
                Rule::unique('learning_sounds', 'slug')->ignore($sound?->id),
            ],
            'icon' => ['required', 'string', Rule::in(['ambience', 'music', 'sfx', 'ui', 'voice'])],
            'url' => ['required', 'string', 'max:2048'],
            'volume' => ['required', 'numeric', 'min:0', 'max:100'],
            'play_seconds' => ['nullable', 'numeric', 'min:0.1', 'max:86400'],
            'loop' => ['required', 'boolean'],
        ];
    }
}
