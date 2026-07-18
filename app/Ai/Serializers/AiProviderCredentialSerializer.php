<?php

namespace App\Ai\Serializers;

use App\Models\AiProviderCredential;

class AiProviderCredentialSerializer
{
    /**
     * @return array<string, mixed>
     */
    public function serialize(AiProviderCredential $credential): array
    {
        return [
            'id' => $credential->id,
            'label' => $credential->label,
            'provider' => $credential->provider,
            'baseUrl' => $credential->base_url,
            'hasApiKey' => filled($credential->api_key_last_four),
            'apiKeyLastFour' => $credential->api_key_last_four,
            'organization' => $credential->organization,
            'enabled' => (bool) $credential->enabled,
            'monthlyTokenLimit' => $credential->monthly_token_limit,
            'monthlyCostLimitCents' => $credential->monthly_cost_limit_cents,
            'notes' => $credential->notes,
            'updatedAt' => $credential->updated_at?->toISOString(),
        ];
    }
}
