<?php

namespace App\Learning\Services;

use App\Access\AccessLevel;
use App\Access\AccessScope;
use App\Access\PermissionCatalog;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\User;

class LearningMapEditAccessService
{
    public function canCreateMap(User $user): bool
    {
        return $user->hasAccess(PermissionCatalog::WORLD_MAPS, AccessLevel::UPDATE);
    }

    public function canEditMap(User $user, LearningMap $map): bool
    {
        return $this->canUpdateMap($user, $map);
    }

    public function canUpdateMap(User $user, LearningMap $map): bool
    {
        return $this->canUseMapScope($user, $map, PermissionCatalog::WORLD_MAPS, AccessLevel::UPDATE)
            || $user->canEditLearningMap($map);
    }

    public function canDeleteMap(User $user, LearningMap $map): bool
    {
        return $this->canUseMapScope($user, $map, PermissionCatalog::WORLD_MAPS, AccessLevel::DELETE);
    }

    public function canManageMapAccess(User $user, LearningMap $map): bool
    {
        return $this->canUseMapScope($user, $map, PermissionCatalog::WORLD_MAP_ACCESS, AccessLevel::UPDATE);
    }

    public function canEditNode(User $user, LearningNode $node): bool
    {
        $node->loadMissing('map');

        return $this->canEditNodesOnMap($user, $node->map);
    }

    public function canEditNodesOnMap(User $user, LearningMap $map): bool
    {
        return $this->canUseMapScope($user, $map, PermissionCatalog::WORLD_NODES, AccessLevel::UPDATE)
            || $user->canEditLearningMap($map);
    }

    public function canDeleteNode(User $user, LearningNode $node): bool
    {
        $node->loadMissing('map');

        return $this->canUseMapScope($user, $node->map, PermissionCatalog::WORLD_NODES, AccessLevel::DELETE);
    }

    public function canEditActivitiesOnNode(User $user, LearningNode $node): bool
    {
        $node->loadMissing('map');

        return $this->canUseMapScope($user, $node->map, PermissionCatalog::WORLD_ACTIVITIES, AccessLevel::UPDATE)
            || $user->canEditLearningMap($node->map);
    }

    public function hasAnyEditableMap(User $user): bool
    {
        return $user->hasAccess(PermissionCatalog::WORLD_MAPS, AccessLevel::UPDATE)
            || $user->hasAccess(PermissionCatalog::WORLD_NODES, AccessLevel::UPDATE)
            || $user->hasAccess(PermissionCatalog::WORLD_ACTIVITIES, AccessLevel::UPDATE)
            || $user->hasGroupEditableMaps();
    }

    public function canSeeAllEditableMaps(User $user): bool
    {
        return $user->hasScopedAccess(PermissionCatalog::WORLD_MAPS, AccessLevel::UPDATE, AccessScope::ALL)
            || $user->hasScopedAccess(PermissionCatalog::WORLD_NODES, AccessLevel::UPDATE, AccessScope::ALL)
            || $user->hasScopedAccess(PermissionCatalog::WORLD_ACTIVITIES, AccessLevel::UPDATE, AccessScope::ALL);
    }

    private function canUseMapScope(User $user, LearningMap $map, string $resource, string $level): bool
    {
        if (! $user->hasAccess($resource, $level)) {
            return false;
        }

        $scope = $user->accessScopeFor($resource, $level);

        if (AccessScope::allows($scope, AccessScope::ALL)) {
            return true;
        }

        if (
            AccessScope::allows($scope, AccessScope::OWN)
            && (int) $map->created_by_user_id === (int) $user->id
        ) {
            return true;
        }

        return AccessScope::allows($scope, AccessScope::ASSIGNED)
            && $user->canEditLearningMap($map);
    }
}
