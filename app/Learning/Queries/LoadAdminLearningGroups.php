<?php

namespace App\Learning\Queries;

use App\Access\AccessLevel;
use App\Access\AccessScope;
use App\Access\PermissionCatalog;
use App\Models\LearningGroup;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class LoadAdminLearningGroups
{
    /**
     * @return Collection<int, LearningGroup>
     */
    public function handle(User $viewer): Collection
    {
        $query = LearningGroup::query();
        $scope = $viewer->accessScopeFor(PermissionCatalog::GROUPS, AccessLevel::READ);

        if (! AccessScope::allows($scope, AccessScope::OWN)) {
            $query->whereKey(-1);
        } elseif (! AccessScope::allows($scope, AccessScope::ALL)) {
            $query->where(function (Builder $query) use ($viewer, $scope): void {
                if (AccessScope::allows($scope, AccessScope::OWN)) {
                    $query->orWhere('learning_groups.created_by_user_id', $viewer->id);
                }

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

        return $query
            ->with([
                'members:id,name,email',
                'messages' => fn ($query) => $query->latest()->limit(80),
                'messages.user:id,name,email',
                'adminChatVotes',
            ])
            ->orderBy('name')
            ->get();
    }
}
