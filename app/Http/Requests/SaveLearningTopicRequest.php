<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SaveLearningTopicRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'content' => ['nullable', 'string', 'max:50000'],
            'description' => ['nullable', 'string', 'max:2400'],
            'is_published' => ['sometimes', 'boolean'],
            'parent_id' => ['nullable', 'integer', 'exists:learning_topics,id'],
            'title' => ['required', 'string', 'max:200'],
        ];
    }
}
