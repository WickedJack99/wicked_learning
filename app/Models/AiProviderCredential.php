<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Stores encrypted credentials for AI providers.
 *
 * The plaintext API key must never be serialized to the frontend.
 */
#[Fillable([
    'label',
    'provider',
    'base_url',
    'api_key',
    'api_key_last_four',
    'organization',
    'enabled',
    'monthly_token_limit',
    'monthly_cost_limit_cents',
    'notes',
])]
class AiProviderCredential extends Model
{
    protected function casts(): array
    {
        return [
            'api_key' => 'encrypted',
            'enabled' => 'boolean',
            'monthly_token_limit' => 'integer',
            'monthly_cost_limit_cents' => 'integer',
        ];
    }

    /**
     * @return HasMany<AiAgentTemplate, $this>
     */
    public function agentTemplates(): HasMany
    {
        return $this->hasMany(AiAgentTemplate::class);
    }
}
