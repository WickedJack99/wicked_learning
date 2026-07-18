<?php

namespace App\Ai\Actions;

use App\Models\AiProviderCredential;

class SaveAiProviderCredential
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, ?AiProviderCredential $credential = null): AiProviderCredential
    {
        $credential ??= new AiProviderCredential;
        $apiKey = trim((string) ($data['api_key'] ?? ''));

        $credential->fill([
            'label' => $data['label'],
            'provider' => $data['provider'],
            'base_url' => $data['base_url'] ?? null,
            'organization' => $data['organization'] ?? null,
            'enabled' => (bool) ($data['enabled'] ?? false),
            'monthly_token_limit' => $data['monthly_token_limit'] ?? null,
            'monthly_cost_limit_cents' => $data['monthly_cost_limit_cents'] ?? null,
            'notes' => $data['notes'] ?? null,
        ]);

        if ($apiKey !== '') {
            $credential->api_key = $apiKey;
            $credential->api_key_last_four = substr($apiKey, -4);
        }

        $credential->save();

        return $credential->refresh();
    }
}
