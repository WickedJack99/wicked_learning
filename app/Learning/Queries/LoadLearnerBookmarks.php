<?php

namespace App\Learning\Queries;

use App\Learning\CurrentWorldResolver;
use App\Learning\Services\LearningBookmarkService;
use App\Models\LearningMap;
use App\Models\LearningNodeBookmark;
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
    public function visibleForUser(int $userId): Collection
    {
        return LearningNodeBookmark::query()
            ->with(['node.map.world'])
            ->where('user_id', $userId)
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
