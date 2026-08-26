<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreLearningTopicAreaRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'after_area_id' => ['nullable', 'integer', 'exists:learning_topic_areas,id'],
            'description' => ['nullable', 'string', 'max:1200'],
            'title' => ['required', 'string', 'max:160'],
        ];
    }
}
