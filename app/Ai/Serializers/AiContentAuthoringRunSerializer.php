<?php

namespace App\Ai\Serializers;

use App\Models\AiContentAuthoringRun;

class AiContentAuthoringRunSerializer
{
    /** @return array<string, mixed> */
    public function serialize(AiContentAuthoringRun $run): array
    {
        return [
            'id' => $run->id,
            'status' => $run->status,
            'contractVersion' => $run->contract_version,
            'plan' => $run->plan,
            'sourceRecords' => $run->context['selectedSourceRecords'] ?? [],
            'warnings' => $run->warnings ?? [],
            'provider' => $run->provider,
            'model' => $run->model,
            'usage' => [
                'inputTokens' => $run->input_tokens,
                'outputTokens' => $run->output_tokens,
                'totalTokens' => $run->total_tokens,
            ],
            'mapAsset' => $run->mapAsset ? [
                'id' => $run->mapAsset->id,
                'title' => $run->mapAsset->node->title,
                'activityCount' => $run->mapAsset->node->activities->count(),
            ] : null,
            'createdAt' => $run->created_at?->toISOString(),
            'appliedAt' => $run->applied_at?->toISOString(),
        ];
    }
}
