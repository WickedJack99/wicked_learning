<?php

namespace App\Learning\Queries;

use App\Models\LearningMapAsset;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/** Loads a bounded page of immutable MapAsset revisions for authors. */
class LoadLearningMapAssetVersions
{
    private const DEFAULT_PAGE_SIZE = 4;

    /** @return LengthAwarePaginator<int, object> */
    public function paginate(
        LearningMapAsset $asset,
        int $page = 1,
        int $perPage = self::DEFAULT_PAGE_SIZE,
    ): LengthAwarePaginator {
        return $asset->versions()
            ->paginate(
                perPage: max(1, min(24, $perPage)),
                page: max(1, $page),
            );
    }
}
