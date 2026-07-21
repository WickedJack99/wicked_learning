<?php

namespace App\Learning\Services;

use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\User;

class LearningMapEditAccessService
{
    public function canEditMap(User $user, LearningMap $map): bool
    {
        return $user->hasAccess(PermissionCatalog::WORLDS, AccessLevel::UPDATE)
            || $user->canEditLearningMap($map);
    }

    public function canEditNode(User $user, LearningNode $node): bool
    {
        $node->loadMissing('map');

        return $this->canEditMap($user, $node->map);
    }

    public function hasAnyEditableMap(User $user): bool
    {
        return $user->hasAccess(PermissionCatalog::WORLDS, AccessLevel::UPDATE)
            || $user->hasGroupEditableMaps();
    }
}
