<?php

namespace App\Ai\Queries;

use App\Models\AiAgentTemplate;

class LoadActivityReviewTemplates
{
    /** @return list<array{id: int, model: string|null, name: string, providerLabel: string|null}> */
    public function handle(bool $allowed): array
    {
        if (! $allowed) {
            return [];
        }

        return array_values(AiAgentTemplate::query()
            ->with('providerCredential')
            ->where('purpose', 'activity_review')
            ->where('enabled', true)
            ->orderBy('name')
            ->get()
            ->map(fn (AiAgentTemplate $template): array => [
                'id' => $template->id,
                'model' => $template->model,
                'name' => $template->name,
                'providerLabel' => $template->providerCredential?->label,
            ])
            ->values()
            ->all());
    }
}
