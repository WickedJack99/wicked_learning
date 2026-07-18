<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveAiProviderCredentialRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'label' => ['required', 'string', 'max:120'],
            'provider' => ['required', 'string', Rule::in([
                'openai',
                'anthropic',
                'gemini',
                'xai',
                'bedrock',
                'ollama',
                'compatible',
                'local',
            ])],
            'base_url' => ['nullable', 'url', 'max:255'],
            'api_key' => ['nullable', 'string', 'max:2000'],
            'organization' => ['nullable', 'string', 'max:255'],
            'enabled' => ['sometimes', 'boolean'],
            'monthly_token_limit' => ['nullable', 'integer', 'min:1'],
            'monthly_cost_limit_cents' => ['nullable', 'integer', 'min:1'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
