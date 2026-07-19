<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSoundPreferenceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'muted' => ['required', 'boolean'],
            'effectsVolume' => ['required', 'integer', 'min:0', 'max:100'],
            'ambienceVolume' => ['required', 'integer', 'min:0', 'max:100'],
        ];
    }
}
