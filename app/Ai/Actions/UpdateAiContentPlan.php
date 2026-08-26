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
        );

        $run->forceFill([
            'plan' => $validatedPlan,
            'warnings' => $this->planValidator->warnings($run->map, $validatedPlan),
        ])->save();

        return $run->refresh();
    }
}
