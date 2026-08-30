<?php

namespace App\Ai\Actions;

use App\Ai\Validation\ContentPlanValidator;
use App\Models\AiContentAuthoringRun;

class UpdateAiContentPlan
{
    public function __construct(
        private readonly ContentPlanValidator $planValidator,
    ) {}

    /**
     * @param  array<string, mixed>  $plan
     */
    public function handle(AiContentAuthoringRun $run, array $plan): AiContentAuthoringRun
    {
        $run->refresh()->loadMissing('map');
        abort_unless($run->status === 'draft' && $run->applied_at === null, 409);

        $context = $run->context ?? [];
        $brief = $context['brief'] ?? [];
        $validatedPlan = $this->planValidator->validate(
            $plan,
            $brief['activityTypes'] ?? null,
            $this->selectedSourceRecordIds($context),
        );

        $run->forceFill([
            'plan' => $validatedPlan,
            'warnings' => $this->planValidator->warnings($run->map, $validatedPlan),
        ])->save();

        return $run->refresh();
    }

    /** @param array<string, mixed> $context @return list<int> */
    private function selectedSourceRecordIds(array $context): array
    {
        return array_values(array_filter(array_map(
            static fn (mixed $record): ?int => is_array($record) && isset($record['id'])
                ? (int) $record['id']
                : null,
            is_array($context['selectedSourceRecords'] ?? null)
                ? $context['selectedSourceRecords']
                : [],
        )));
    }
}
