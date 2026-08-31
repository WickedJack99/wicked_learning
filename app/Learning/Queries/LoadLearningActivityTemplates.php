<?php

namespace App\Learning\Queries;

use App\Models\LearningActivityTemplate;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class LoadLearningActivityTemplates
{
    private const DEFAULT_PAGE_SIZE = 8;

    /** @return LengthAwarePaginator<int, LearningActivityTemplate> */
    public function paginate(
        User $user,
        int $page = 1,
        int $perPage = self::DEFAULT_PAGE_SIZE,
        ?string $search = null,
    ): LengthAwarePaginator {
        $search = trim((string) $search);
        $perPage = max(1, min(24, $perPage));

        return LearningActivityTemplate::query()
            ->where(function (Builder $query) use ($user): void {
                $query
                    ->where('created_by_user_id', $user->id)
                    ->orWhereIn(
                        'organization_id',
                        $user->organizationMemberships()->select('organization_id'),
                    );
            })
            ->when($search !== '', function (Builder $query) use ($search): void {
                $like = "%{$search}%";

                $query->where(function (Builder $query) use ($like): void {
                    $query->where('name', 'like', $like)
                        ->orWhere('type', 'like', $like);
                });
            })
            ->with('organization:id,name')
            ->orderBy('name')
            ->orderBy('id')
            ->paginate(perPage: $perPage, page: max(1, $page));
    }
}
