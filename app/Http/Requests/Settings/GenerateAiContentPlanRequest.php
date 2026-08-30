<?php

namespace App\Http\Requests\Settings;

use App\ContentApi\ContentPlanContract;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GenerateAiContentPlanRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'template_id' => ['required', 'integer', 'exists:ai_agent_templates,id'],
            'goal' => ['required', 'string', 'max:4000'],
            'target_audience' => ['nullable', 'string', 'max:1000'],
            'prior_knowledge' => ['nullable', 'string', 'max:1000'],
            'route_length' => ['required', 'integer', 'min:1', 'max:3'],
            'activity_types' => ['required', 'array', 'min:1', 'max:3'],
            'activity_types.*' => ['required', 'string', 'distinct', Rule::in(ContentPlanContract::ACTIVITY_TYPES)],
            'source_record_ids' => ['sometimes', 'array', 'max:5'],
            'source_record_ids.*' => ['required', 'integer', 'distinct', 'exists:learning_source_records,id'],
        ];
    }
}
