<?php

namespace App\Learning\Queries;

use App\Models\PlatformFeedback;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/** Loads a bounded page of platform feedback for authorized reviewers. */
class LoadAdminPlatformFeedback
{
    public const PAGE_SIZE = 8;

    /** @return LengthAwarePaginator<int, PlatformFeedback> */
    public function handle(int $page = 1): LengthAwarePaginator
    {
        $query = PlatformFeedback::query()
            ->with('user')
            ->orderByRaw('reviewed_at is null desc')
            ->latest('submitted_at');

        $feedback = $query->paginate(
            perPage: self::PAGE_SIZE,
            pageName: 'platform_feedback_page',
            page: max(1, $page),
        );

        if (
            $feedback->isEmpty()
            && $feedback->total() > 0
            && $feedback->currentPage() > $feedback->lastPage()
        ) {
            return $query->paginate(
                perPage: self::PAGE_SIZE,
                pageName: 'platform_feedback_page',
                page: $feedback->lastPage(),
            );
        }

        return $feedback;
    }
}
