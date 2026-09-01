<?php

namespace App\Learning\Queries;

use App\Models\LearningWorld;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/** Loads a bounded page of immutable world-detail revisions for authors. */
class LoadLearningWorldVersions
{
    private const int DEFAULT_PAGE_SIZE = 6;

    /** @return LengthAwarePaginator<int, object> */
    public function paginate(
        LearningWorld $world,
        int $page = 1,
        int $perPage = self::DEFAULT_PAGE_SIZE,
    ): LengthAwarePaginator {
        return $world->versions()
            ->paginate(
                perPage: max(1, min(24, $perPage)),
                page: max(1, $page),
            );
    }
}
