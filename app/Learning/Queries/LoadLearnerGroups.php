<?php

namespace App\Learning\Queries;

use App\Models\LearningGroup;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

class LoadLearnerGroups
{
    public const DEFAULT_PAGE_SIZE = 1;

    public const MAX_PAGE_SIZE = 12;

    /**
     * @return LengthAwarePaginator<int, LearningGroup>
     */
    public function handle(
        User $user,
        int $page = 1,
        int $perPage = self::DEFAULT_PAGE_SIZE,
    ): LengthAwarePaginator {
        $perPage = min(max($perPage, 1), self::MAX_PAGE_SIZE);
        $page = max($page, 1);
        $query = $this->query($user);
        $groups = $query->paginate($perPage, ['*'], 'page', $page);

        if ($groups->isEmpty() && $groups->total() > 0 && $page > $groups->lastPage()) {
            return $query->paginate($perPage, ['*'], 'page', $groups->lastPage());
        }

        return $groups;
    }

    /**
     * @return Builder<LearningGroup>
     */
    private function query(User $user): Builder
    {
        return LearningGroup::query()
            ->with([
                'members:id,name,email',
                'messages' => fn ($query) => $query->latest()->limit(40),
                'messages.user:id,name,email',
                'adminChatVotes',
            ])
            ->whereHas('members', fn ($query) => $query->whereKey($user->id))
            ->orderBy('name');
    }
}
