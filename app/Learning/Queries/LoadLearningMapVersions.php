<?php

namespace App\Learning\Queries;

use App\Models\LearningMap;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/** Loads a bounded page of immutable map-detail revisions for authors. */
class LoadLearningMapVersions
{
    private const DEFAULT_PAGE_SIZE = 6;

    /** @return LengthAwarePaginator<int, object> */
    public function paginate(
        LearningMap $map,
        int $page = 1,
        int $perPage = self::DEFAULT_PAGE_SIZE,
    ): LengthAwarePaginator {
        return $map->versions()
            ->latest('created_at')
            ->latest('id')
            ->paginate(
                perPage: max(1, min(24, $perPage)),
                page: max(1, $page),
            );
    }
}
