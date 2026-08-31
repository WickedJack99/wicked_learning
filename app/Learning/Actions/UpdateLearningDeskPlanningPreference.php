<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearningDeskPlanningPreference;
use App\Models\User;

class UpdateLearningDeskPlanningPreference
{
    public function __construct(
        private readonly LearningDeskPlanningPreference $planningPreference,
    ) {}

    /** @param array{purposeFilter: string, timeBudget: int|string} $data */
    public function handle(User $user, array $data): void
    {
        $this->planningPreference->save($user, $data);
    }
}
