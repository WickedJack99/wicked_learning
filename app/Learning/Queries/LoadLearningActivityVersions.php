<?php

namespace App\Learning\Queries;

use App\Models\LearningActivity;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/** Loads a bounded page of immutable activity configuration revisions. */
class LoadLearningActivityVersions
{
    private const DEFAULT_PAGE_SIZE = 6;

    /** @return LengthAwarePaginator<int, object> */
    public function paginate(
        LearningActivity $activity,
        int $page = 1,
        int $perPage = self::DEFAULT_PAGE_SIZE,
    ): LengthAwarePaginator {
        return $activity->versions()
            ->paginate(
                perPage: max(1, min(24, $perPage)),
                page: max(1, $page),
            );
    }
}
