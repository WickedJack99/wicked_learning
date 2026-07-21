<?php

namespace App\Learning\Queries;

use App\Models\LearningGroup;
use Illuminate\Database\Eloquent\Collection;

class LoadAdminLearningGroups
{
    /**
     * @return Collection<int, LearningGroup>
     */
    public function handle(): Collection
    {
        return LearningGroup::query()
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
