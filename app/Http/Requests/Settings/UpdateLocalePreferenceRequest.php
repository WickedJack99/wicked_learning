<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

class UpdateLocalePreferenceRequest extends FormRequest
{
    public function rules(): array
    {
        return ['locale' => ['required', 'string', 'max:16']];
    }
}
