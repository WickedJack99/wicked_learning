<?php

namespace App\Ai\Serializers;

use App\Models\AiAgentTemplate;

class AiAgentTemplateSerializer
{
    /**
     * @return array<string, mixed>
     */
    public function serialize(AiAgentTemplate $template): array
    {
        return [
            'id' => $template->id,
            'aiProviderCredentialId' => $template->ai_provider_credential_id,
            'providerLabel' => $template->providerCredential?->label,
            'name' => $template->name,
            'slug' => $template->slug,
            'purpose' => $template->purpose,
            'model' => $template->model,
            'systemPrompt' => $template->system_prompt,
            'taskPrompt' => $template->task_prompt,
            'temperature' => $template->temperature,
            'maxOutputTokens' => $template->max_output_tokens,
            'concurrencyLimit' => $template->concurrency_limit,
            'monthlyTokenLimit' => $template->monthly_token_limit,
            'enabled' => (bool) $template->enabled,
            'guardedContext' => (bool) $template->guarded_context,
            'createdByName' => $template->createdBy?->name,
            'updatedAt' => $template->updated_at?->toISOString(),
        ];
    }
}
