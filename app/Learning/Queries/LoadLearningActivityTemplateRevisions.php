<?php

namespace App\Learning\Queries;

use App\Models\LearningActivityTemplate;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class LoadLearningActivityTemplateRevisions
{
    /** @return LengthAwarePaginator<int, object> */
    public function paginate(
        LearningActivityTemplate $template,
        int $page = 1,
        int $perPage = 6,
    ): LengthAwarePaginator {
        return $template->revisions()
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(
                perPage: max(1, min(24, $perPage)),
                page: max(1, $page),
            );
    }
}
