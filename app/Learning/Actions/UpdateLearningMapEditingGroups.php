<?php

namespace App\Learning\Actions;

use App\Models\LearningMap;

class UpdateLearningMapEditingGroups
{
    /**
     * @param  array<int, int|string>  $groupIds
     */
    public function handle(LearningMap $map, array $groupIds): LearningMap
    {
        $map->editingGroups()->sync(array_values(array_unique(array_map('intval', $groupIds))));

        return $map->refresh()->load('editingGroups');
    }
}
