<?php

namespace App\Learning\Queries;

use App\Models\LearningMap;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class LoadLearningMapLayoutVersions
{
    /** @return LengthAwarePaginator<int, object> */
    public function paginate(
        LearningMap $map,
        int $page = 1,
        int $perPage = 6,
    ): LengthAwarePaginator {
        return $map->layoutVersions()
            ->latest('created_at')
            ->latest('id')
            ->paginate(
                perPage: max(1, min(24, $perPage)),
                page: max(1, $page),
            );
    }
}
