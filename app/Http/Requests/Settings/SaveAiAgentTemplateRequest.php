<?php

namespace App\Http\Requests\Settings;

use App\Models\AiAgentTemplate;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveAiAgentTemplateRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var AiAgentTemplate|null $template */
        $template = $this->route('template');

        return [
            'ai_provider_credential_id' => ['nullable', 'integer', 'exists:ai_provider_credentials,id'],
            'name' => ['required', 'string', 'max:120'],
            'slug' => [
                'nullable',
                'alpha_dash',
                'max:140',
                Rule::unique('ai_agent_templates', 'slug')->ignore($template),
            ],
            'purpose' => ['required', 'string', Rule::in([
                'sdt_design',
                'asset_generation',
                'learner_feedback',
                'general_assistant',
            ])],
            'model' => ['nullable', 'string', 'max:120'],
            'system_prompt' => ['nullable', 'string', 'max:12000'],
            'task_prompt' => ['nullable', 'string', 'max:12000'],
            'temperature' => ['required', 'numeric', 'min:0', 'max:2'],
            'max_output_tokens' => ['nullable', 'integer', 'min:1', 'max:128000'],
            'concurrency_limit' => ['required', 'integer', 'min:1', 'max:20'],
            'monthly_token_limit' => ['nullable', 'integer', 'min:1'],
            'enabled' => ['sometimes', 'boolean'],
            'guarded_context' => ['sometimes', 'boolean'],
        ];
    }
}
