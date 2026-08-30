<?php

namespace App\Learning\Queries;

use App\Models\LearningSourceRecord;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/** Loads a bounded page of immutable source-record revisions for authors. */
class LoadSourceRecordVersions
{
    private const DEFAULT_PAGE_SIZE = 8;

    /** @return LengthAwarePaginator<int, object> */
    public function paginate(
        LearningSourceRecord $sourceRecord,
        int $page = 1,
        int $perPage = self::DEFAULT_PAGE_SIZE,
    ): LengthAwarePaginator {
        return $sourceRecord->versions()
            ->latest('created_at')
            ->latest('id')
            ->paginate(
                perPage: max(1, min(24, $perPage)),
                page: max(1, $page),
            );
    }
}
