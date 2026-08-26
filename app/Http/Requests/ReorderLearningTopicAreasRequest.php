<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReorderLearningTopicAreasRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'area_ids' => ['required', 'array'],
            'area_ids.*' => ['required', 'integer', 'distinct', 'exists:learning_topic_areas,id'],
        ];
    }
}
