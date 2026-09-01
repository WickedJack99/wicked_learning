<?php

namespace App\Learning\Services;

use App\Access\AccessLevel;
use App\Access\AccessScope;
use App\Access\PermissionCatalog;
use App\Models\LearningGroup;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class LearningGroupManagementService
{
    public function canManage(User $viewer, LearningGroup $group, string $resource = PermissionCatalog::GROUPS): bool
    {
        if (! $viewer->hasAccess($resource, AccessLevel::UPDATE)) {
            return false;
        }

        $scope = $viewer->accessScopeFor($resource, AccessLevel::UPDATE);

        if (AccessScope::allows($scope, AccessScope::ALL)) {
            return true;
        }

        if (
            AccessScope::allows($scope, AccessScope::OWN)
            && (int) $group->created_by_user_id === (int) $viewer->id
        ) {
            return true;
        }

        return AccessScope::allows($scope, AccessScope::ASSIGNED)
            && $viewer->learningGroups()
                ->whereKey($group->id)
                ->wherePivot('role', 'manager')
                ->exists();
    }

    /**
     * @param  Builder<LearningGroup>  $query
     * @return Builder<LearningGroup>
     */
    public function scopeManageable(
        Builder $query,
        User $viewer,
        string $resource = PermissionCatalog::GROUPS,
    ): Builder {
        $scope = $viewer->accessScopeFor($resource, AccessLevel::UPDATE);

        if (! AccessScope::allows($scope, AccessScope::OWN)) {
            return $query->whereKey(-1);
        }

        if (AccessScope::allows($scope, AccessScope::ALL)) {
            return $query;
        }

        return $query->where(function (Builder $query) use ($viewer, $scope): void {
            $query->where('learning_groups.created_by_user_id', $viewer->id);

            if (AccessScope::allows($scope, AccessScope::ASSIGNED)) {
                $query->orWhereHas(
                    'members',
                    fn (Builder $memberQuery) => $memberQuery
                        ->whereKey($viewer->id)
                        ->where('learning_group_user.role', 'manager'),
                );
            }
        });
    }
}
