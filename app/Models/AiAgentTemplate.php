<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Describes an AI behavior that can later be executed by queued runtime jobs.
 */
#[Fillable([
    'ai_provider_credential_id',
    'created_by_user_id',
    'name',
    'slug',
    'purpose',
    'model',
    'system_prompt',
    'task_prompt',
    'temperature',
    'max_output_tokens',
    'concurrency_limit',
    'monthly_token_limit',
    'enabled',
    'guarded_context',
])]
class AiAgentTemplate extends Model
{
    protected function casts(): array
    {
        return [
            'temperature' => 'float',
            'max_output_tokens' => 'integer',
            'concurrency_limit' => 'integer',
            'monthly_token_limit' => 'integer',
            'enabled' => 'boolean',
            'guarded_context' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<AiProviderCredential, $this>
     */
    public function providerCredential(): BelongsTo
    {
        return $this->belongsTo(AiProviderCredential::class, 'ai_provider_credential_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }
}
