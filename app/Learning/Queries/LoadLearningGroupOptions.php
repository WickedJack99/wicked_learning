<?php

namespace App\Learning\Queries;

use App\Learning\Serializers\LearningGroupSerializer;
use App\Learning\Services\LearningGroupManagementService;
use App\Models\LearningGroup;
use App\Models\User;

class LoadLearningGroupOptions
{
    public function __construct(
        private readonly LearningGroupSerializer $serializer,
        private readonly LearningGroupManagementService $groupManagement,
    ) {}

    /**
     * @return array<int, array<string, mixed>>
     */
    public function handle(User $viewer): array
    {
        return $this->groupManagement
            ->scopeManageable(LearningGroup::query(), $viewer)
            ->orderBy('name')
            ->get()
            ->map(fn (LearningGroup $group): array => $this->serializer->option($group))
            ->all();
    }
}
