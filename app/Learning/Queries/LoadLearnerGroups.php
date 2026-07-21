<?php

namespace App\Learning\Queries;

use App\Models\LearningGroup;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

class LoadLearnerGroups
{
    /**
     * @return Collection<int, LearningGroup>
     */
    public function handle(User $user): Collection
    {
        return LearningGroup::query()
            ->with([
                'members:id,name,email',
                'messages' => fn ($query) => $query->latest()->limit(40),
                'messages.user:id,name,email',
                'adminChatVotes',
            ])
            ->whereHas('members', fn ($query) => $query->whereKey($user->id))
            ->orderBy('name')
            ->get();
    }
}
