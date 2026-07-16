<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePlatformLanguageRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:80'],
            'native_name' => ['required', 'string', 'max:80'],
            'is_enabled' => ['required', 'boolean'],
        ];
    }
}
