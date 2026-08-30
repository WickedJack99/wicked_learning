<?php

namespace App\Learning\Queries;

use App\Models\LearningSourceRecord;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/** Loads a bounded source catalog for authoring reuse. */
class LoadEditableSourceRecords
{
    private const DEFAULT_PAGE_SIZE = 12;

    /** @return LengthAwarePaginator<int, LearningSourceRecord> */
    public function paginate(
        int $page = 1,
        int $perPage = self::DEFAULT_PAGE_SIZE,
        ?string $search = null,
    ): LengthAwarePaginator {
        $perPage = max(1, min(24, $perPage));
        $page = max(1, $page);
        $search = trim((string) $search);

        return LearningSourceRecord::query()
            ->when($search !== '', function (Builder $query) use ($search): void {
                $like = "%{$search}%";

                $query->where(function (Builder $query) use ($like): void {
                    $query
                        ->where('title', 'like', $like)
                        ->orWhere('url', 'like', $like)
                        ->orWhere('publisher', 'like', $like);
                });
            })
            ->orderBy('title')
            ->orderBy('id')
            ->paginate(perPage: $perPage, page: $page);
    }
}
