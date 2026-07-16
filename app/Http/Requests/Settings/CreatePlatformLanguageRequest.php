<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreatePlatformLanguageRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'not_in:en', 'regex:/^[a-z]{2,3}(-[A-Z]{2})?$/', 'max:16', Rule::unique('platform_languages', 'code')],
            'name' => ['required', 'string', 'max:80'],
            'native_name' => ['required', 'string', 'max:80'],
            'is_enabled' => ['sometimes', 'boolean'],
        ];
    }
}
