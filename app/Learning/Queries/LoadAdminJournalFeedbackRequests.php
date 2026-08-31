<?php

namespace App\Learning\Queries;

use App\Models\LearnerJournalFeedbackRequest;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/** Loads requested and completed journal feedback for administration. */
class LoadAdminJournalFeedbackRequests
{
    public const PAGE_SIZE = 6;

    /** @return LengthAwarePaginator<int, LearnerJournalFeedbackRequest> */
    public function handle(int $page = 1): LengthAwarePaginator
    {
        $query = LearnerJournalFeedbackRequest::query()
            ->with(['page', 'requester'])
            ->latest('requested_at');

        $feedbackRequests = $query->paginate(
            perPage: self::PAGE_SIZE,
            pageName: 'feedback_page',
            page: max(1, $page),
        );

        if (
            $feedbackRequests->isEmpty()
            && $feedbackRequests->total() > 0
            && $feedbackRequests->currentPage() > $feedbackRequests->lastPage()
        ) {
            return $query->paginate(
                perPage: self::PAGE_SIZE,
                pageName: 'feedback_page',
                page: $feedbackRequests->lastPage(),
            );
        }

        return $feedbackRequests;
    }
}
