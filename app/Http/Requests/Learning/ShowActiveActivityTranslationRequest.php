<?php

namespace App\Http\Requests\Learning;

use Illuminate\Foundation\Http\FormRequest;

class ShowActiveActivityTranslationRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'play_run_id' => ['required', 'uuid'],
        ];
    }
}
