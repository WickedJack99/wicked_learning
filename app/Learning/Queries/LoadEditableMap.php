<?php

namespace App\Learning\Queries;

use App\Models\LearningMap;

class LoadEditableMap
{
    public function handle(LearningMap $map): LearningMap
    {
        $map->loadMissing('world', 'nodes', 'editingGroups');

        return $map;
    }
}
