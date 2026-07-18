<?php

namespace App\Ai\Queries;

use App\Ai\Serializers\AiAgentTemplateSerializer;
use App\Ai\Serializers\AiProviderCredentialSerializer;
use App\Models\AiAgentTemplate;
use App\Models\AiProviderCredential;

class LoadAiSettings
{
    public function __construct(
        private readonly AiProviderCredentialSerializer $credentialSerializer,
        private readonly AiAgentTemplateSerializer $templateSerializer,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(): array
    {
        return [
            'providerCredentials' => AiProviderCredential::query()
                ->orderBy('label')
                ->get()
                ->map(fn (AiProviderCredential $credential): array => $this->credentialSerializer->serialize($credential))
                ->values(),
            'agentTemplates' => AiAgentTemplate::query()
                ->with(['providerCredential', 'createdBy'])
                ->orderBy('purpose')
                ->orderBy('name')
                ->get()
                ->map(fn (AiAgentTemplate $template): array => $this->templateSerializer->serialize($template))
                ->values(),
            'providerOptions' => $this->providerOptions(),
            'purposeOptions' => $this->purposeOptions(),
            'guardrailNotes' => [
                'API keys are encrypted at rest and are never serialized back to the browser after saving.',
                'Guarded-context templates should receive learner data only through explicit activity or route loaders.',
                'Concurrency and monthly limits describe queued runtime guardrails for future AI jobs.',
            ],
        ];
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function providerOptions(): array
    {
        return [
            ['value' => 'openai', 'label' => 'OpenAI'],
            ['value' => 'anthropic', 'label' => 'Anthropic'],
            ['value' => 'gemini', 'label' => 'Google Gemini'],
            ['value' => 'xai', 'label' => 'xAI'],
            ['value' => 'bedrock', 'label' => 'Amazon Bedrock'],
            ['value' => 'ollama', 'label' => 'Ollama'],
            ['value' => 'compatible', 'label' => 'OpenAI-compatible'],
            ['value' => 'local', 'label' => 'Local service'],
        ];
    }

    /**
     * @return list<array{value: string, label: string, description: string}>
     */
    private function purposeOptions(): array
    {
        return [
            [
                'value' => 'sdt_design',
                'label' => 'SDT design helper',
                'description' => 'Helps admins review learning flows for autonomy, competence and relatedness.',
            ],
            [
                'value' => 'asset_generation',
                'label' => 'Asset generation helper',
                'description' => 'Drafts prompts or asset ideas for worlds, tiles and activity scenes.',
            ],
            [
                'value' => 'learner_feedback',
                'label' => 'Learner feedback helper',
                'description' => 'Prepares informational feedback for reflections without scores or pressure loops.',
            ],
            [
                'value' => 'general_assistant',
                'label' => 'General assistant',
                'description' => 'A broader helper for tasks that do not need sensitive learner context.',
            ],
        ];
    }
}
