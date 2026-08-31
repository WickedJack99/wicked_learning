<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Learning\Services\LearningBookmarkService;
use App\Models\LearningMap;
use App\Models\LearningNodeBookmark;
use App\Models\User;
use Illuminate\Support\Collection;

class LoadLearnerBookmarks
{
    public function __construct(
        private readonly CurrentWorldResolver $worldResolver,
        private readonly LearningBookmarkService $bookmarkService,
    ) {}

    /**
     * @return Collection<int, LearningNodeBookmark>
     */
    public function visibleForUser(User $user): Collection
    {
        $query = LearningNodeBookmark::query()
            ->with(['node.map.world', 'node.map.topic', 'node.mapAsset'])
            ->where('user_id', $user->id);

        $this->bookmarkService->constrainVisibleBookmarkQuery($query, $user);

        return $query
            ->oldest()
            ->get()
            ->filter(fn (LearningNodeBookmark $bookmark): bool => $this->bookmarkService->isVisibleNode($bookmark->node))
            ->values();
    }

    public function templateMap(): ?LearningMap
    {
        return $this->worldResolver
            ->query()
            ->with('maps')
            ->first()
            ?->maps
            ->first();
    }
}
