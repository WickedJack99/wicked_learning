<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

class ReviewLearningActivityRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'template_id' => ['required', 'integer', 'exists:ai_agent_templates,id'],
        ];
    }
}
