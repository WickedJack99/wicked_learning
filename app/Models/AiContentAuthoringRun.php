<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property array{brief?: array{activityTypes?: list<string>}, selectedSourceRecords?: list<array<string, mixed>>}|null $context
 * @property array<string, mixed>|null $plan
 * @property list<string>|null $warnings
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $applied_at
 */
#[Fillable([
    'learning_map_id',
    'ai_agent_template_id',
    'created_by_user_id',
    'applied_by_user_id',
    'learning_map_asset_id',
    'contract_version',
    'prompt',
    'context',
    'plan',
    'warnings',
    'provider',
    'model',
    'provider_response_id',
    'provider_request_id',
    'input_tokens',
    'output_tokens',
    'total_tokens',
    'status',
    'applied_at',
])]
class AiContentAuthoringRun extends Model
{
    protected function casts(): array
    {
        return [
            'context' => 'array',
            'plan' => 'array',
            'warnings' => 'array',
            'input_tokens' => 'integer',
            'output_tokens' => 'integer',
            'total_tokens' => 'integer',
            'applied_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<LearningMap, $this> */
    public function map(): BelongsTo
    {
        return $this->belongsTo(LearningMap::class, 'learning_map_id');
    }

    /** @return BelongsTo<AiAgentTemplate, $this> */
    public function agentTemplate(): BelongsTo
    {
        return $this->belongsTo(AiAgentTemplate::class, 'ai_agent_template_id');
    }

    /** @return BelongsTo<User, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /** @return BelongsTo<User, $this> */
    public function appliedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'applied_by_user_id');
    }

    /** @return BelongsTo<LearningMapAsset, $this> */
    public function mapAsset(): BelongsTo
    {
        return $this->belongsTo(LearningMapAsset::class, 'learning_map_asset_id');
    }
}
