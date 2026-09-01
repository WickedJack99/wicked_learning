<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearningGroupManagementService;
use App\Models\LearningGroup;
use App\Models\LearningMap;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

class UpdateLearningMapEditingGroups
{
    public function __construct(private readonly LearningGroupManagementService $groupManagement) {}

    /**
     * @param  array<int, int|string>  $groupIds
     */
    public function handle(LearningMap $map, array $groupIds, User $viewer): LearningMap
    {
        $normalizedGroupIds = array_values(array_unique(array_map('intval', $groupIds)));
        $manageableGroupCount = $this->groupManagement
            ->scopeManageable(LearningGroup::query()->whereKey($normalizedGroupIds), $viewer)
            ->count();

        if ($manageableGroupCount !== count($normalizedGroupIds)) {
            throw new AuthorizationException('You may only assign learning groups that you manage.');
        }

        $map->editingGroups()->sync($normalizedGroupIds);

        return $map->refresh()->load('editingGroups');
    }
}
