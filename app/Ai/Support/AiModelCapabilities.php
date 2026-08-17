<?php

namespace App\Ai\Support;

use App\Models\AiAgentTemplate;
use App\Models\AiProviderCredential;

class AiModelCapabilities
{
    public const REASONING_EFFORTS = [
        'none',
        'low',
        'medium',
        'high',
        'xhigh',
        'max',
    ];

    /**
     * Rules are serialized for the settings UI so the browser and server use
     * the same known model capabilities. Unknown models keep safe, optional
     * controls and rely on their provider's validation.
     *
     * @return list<array{provider: string, modelPrefix: string, mode: string}>
     */
    public function rules(): array
    {
        return [
            [
                'provider' => 'openai',
                'modelPrefix' => 'gpt-5.6',
                'mode' => 'reasoning',
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function requestOptions(
        AiProviderCredential $credential,
        AiAgentTemplate $template,
        string $model,
    ): array {
        if ($this->controlMode($credential->provider, $model) === 'reasoning') {
            return filled($template->reasoning_effort)
                ? ['reasoning' => ['effort' => $template->reasoning_effort]]
                : [];
        }

        if (filled($template->reasoning_effort)) {
            return ['reasoning' => ['effort' => $template->reasoning_effort]];
        }

        return $template->temperature !== null
            ? ['temperature' => $template->temperature]
            : [];
    }

    public function controlMode(string $provider, string $model): string
    {
        $normalizedProvider = strtolower(trim($provider));
        $normalizedModel = strtolower(trim($model));

        foreach ($this->rules() as $rule) {
            if ($normalizedProvider !== $rule['provider']) {
                continue;
            }

            if (str_starts_with($normalizedModel, $rule['modelPrefix'])) {
                return $rule['mode'];
            }
        }

        return 'flexible';
    }
}
